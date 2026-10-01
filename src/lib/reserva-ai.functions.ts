import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gatewayFetch } from "./ai-gateway.server";

const input = z.object({
  texto: z.string().max(100_000).nullable(),
  arquivo: z.string().max(14_000_000).nullable(),
  nome: z.string().max(160).nullable(),
  mime: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]).nullable(),
  /** Tipo do formulário aberto; ajuda o modelo a focar nos campos certos. */
  esperado: z.enum(["voo", "hotel", "reserva", "despesa"]).optional(),
});

/** Modelo da leitura de reservas (trocar aqui). Gemini 2.5 Flash testado em 29/09: errou valor, horário e bagagem; mantido este. */
export const MODELO_LEITURA = "openai/gpt-6-astra";

const TIPOS = ["voo", "trem", "onibus", "hotel", "carro", "passeio", "restaurante", "outro", "despesa"] as const;
const s = { type: ["string", "null"] };

const n = { type: ["number", "null"] };
const BAG_SCHEMA = {
  type: ["object", "null"], additionalProperties: false,
  properties: { bag_mao_qtd: n, bag_mao_kg: n, item_pessoal: { type: ["boolean", "null"] }, bag_desp_qtd: n, bag_desp_kg: n },
  required: ["bag_mao_qtd", "bag_mao_kg", "item_pessoal", "bag_desp_qtd", "bag_desp_kg"],
};
const bagZ = z.object({ bag_mao_qtd: z.number().nullable(), bag_mao_kg: z.number().nullable(), item_pessoal: z.boolean().nullable(), bag_desp_qtd: z.number().nullable(), bag_desp_kg: z.number().nullable() }).nullable();

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    tipo: { type: "string", enum: [...TIPOS] },
    titulo: s, companhia: s, numero: s, localizador: s, origem_iata: s, destino_iata: s,
    origem_cidade: s, destino_cidade: s, inicio: s, fim: s, local: s, cidade: s,
    valor: { type: ["number", "null"] }, moeda: s, cancelamento_gratis_ate: s, politica_cancelamento: s,
    categoria: { type: ["string", "null"], enum: ["transporte", "hospedagem", "alimentacao", "mercado", "atracoes", "compras", "outros", null] },
    passageiros: {
      type: "array",
      items: { type: "object", additionalProperties: false, properties: { nome: { type: "string" }, assento: s, eticket: s }, required: ["nome", "assento", "eticket"] },
    },
    quartos: {
      type: "array",
      items: { type: "object", additionalProperties: false, properties: { nome: { type: "string" }, tipo: s, hospedes: { type: "array", items: { type: "string" } } }, required: ["nome", "tipo", "hospedes"] },
    },
    pessoas: { type: "array", items: { type: "string" } },
    bagagem: BAG_SCHEMA,
  },
  required: ["bagagem", "tipo", "titulo", "companhia", "numero", "localizador", "origem_iata", "destino_iata", "origem_cidade", "destino_cidade", "inicio", "fim", "local", "cidade", "valor", "moeda", "cancelamento_gratis_ate", "politica_cancelamento", "categoria", "passageiros", "quartos", "pessoas"],
};

const saida = z.object({
  tipo: z.enum(TIPOS), titulo: z.string().nullable(), companhia: z.string().nullable(), numero: z.string().nullable(),
  localizador: z.string().nullable(), origem_iata: z.string().nullable(), destino_iata: z.string().nullable(),
  origem_cidade: z.string().nullable(), destino_cidade: z.string().nullable(), inicio: z.string().nullable(), fim: z.string().nullable(),
  local: z.string().nullable(), cidade: z.string().nullable(), valor: z.number().nullable(), moeda: z.string().nullable(),
  cancelamento_gratis_ate: z.string().nullable(), politica_cancelamento: z.string().nullable(), categoria: z.string().nullable(),
  passageiros: z.array(z.object({ nome: z.string(), assento: z.string().nullable(), eticket: z.string().nullable() })),
  quartos: z.array(z.object({ nome: z.string(), tipo: z.string().nullable(), hospedes: z.array(z.string()) })),
  pessoas: z.array(z.string()),
  bagagem: bagZ.optional().default(null),
});
export type Leitura = z.infer<typeof saida>;

const FOCO: Record<string, string> = {
  voo: "O usuário está cadastrando um voo/trem/ônibus: foque em companhia, número, IATA, horários, passageiros (nome como no bilhete, assento, e-ticket) e franquia de bagagem (mão: quantidade e kg; item pessoal; despachada: quantidade e kg por mala) se estiver escrita. Localizador: use SEMPRE o código de reserva da companhia aérea (airline record locator / PNR da cia, ex.: DLPDCU); se houver também um código da agência (booking reference da agência), ignore-o.",
  hotel: "O usuário está cadastrando uma hospedagem: titulo = nome do hotel, local = endereço, inicio = check-in, fim = check-out, quartos com hóspedes.",
  reserva: "O usuário está cadastrando uma reserva (carro, passeio, restaurante ou outro): titulo, local, início, fim e pessoas.",
  despesa: "O usuário está lançando uma despesa (recibo/nota): tipo = despesa, titulo = descrição curta, valor total, moeda, inicio = data, categoria.",
};

function safeMessage(status: number, body: string) {
  try { const j = JSON.parse(body) as { message?: string; error?: { message?: string } }; return j.message ?? j.error?.message ?? `A leitura falhou (${status}).`; }
  catch { return `A leitura falhou (${status}).`; }
}

export const extrairReserva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data }): Promise<Leitura> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("A leitura automática não está configurada.");
    if (!data.texto?.trim() && !data.arquivo) throw new Error("Escolha um arquivo ou cole um texto.");
    const instr = [
      "Extraia os dados desta reserva/documento de viagem. Não adivinhe: campo ausente = null, lista ausente = [].",
      "Datas: ISO local YYYY-MM-DDTHH:mm (hora do lugar), data simples YYYY-MM-DD. Moeda ISO 4217. IATA com 3 letras.",
      "Nomes de pessoas: escreva como 'Nome Sobrenome' (converta SOBRENOME/NOME MR para Nome Sobrenome, sem títulos).",
      data.esperado ? FOCO[data.esperado] : "",
    ].join(" ");
    const content: Record<string, unknown>[] = [{ type: "input_text", text: instr }];
    if (data.texto?.trim()) content.push({ type: "input_text", text: data.texto.trim() });
    if (data.arquivo && data.mime?.startsWith("image/")) content.push({ type: "input_image", image_url: data.arquivo });
    if (data.arquivo && data.mime === "application/pdf") content.push({ type: "input_file", filename: data.nome ?? "reserva.pdf", file_data: data.arquivo });
    const output = await chamarIA(key, content, "reserva_viagem", schema);
    return saida.parse(JSON.parse(output));
  });

async function chamarIA(key: string, content: Record<string, unknown>[], nome: string, sch: unknown): Promise<string> {
    const run = gatewayFetch();
    const response = await run.fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: MODELO_LEITURA, stream: true,
        input: [{ role: "user", content }],
        reasoning: { effort: "low" }, store: false,
        text: { format: { type: "json_schema", name: nome, strict: true, schema: sch } },
      }),
    });
    if (!response.ok) {
      const corpo = await response.text();
      console.error(`leitura IA [${response.status}]: ${corpo.slice(0, 400)}`);
      throw new Error(safeMessage(response.status, corpo));
    }
    if (!response.body) throw new Error("A leitura terminou sem resposta.");
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let output = "";
    while (true) {
      const next = await reader.read(); if (next.done) break; buffer += decoder.decode(next.value, { stream: true });
      const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
      for (const line of lines) if (line.startsWith("data: ")) {
        const raw = line.slice(6); if (raw === "[DONE]") continue;
        try {
          const event = JSON.parse(raw) as { type?: string; delta?: string; response?: { error?: { message?: string } } };
          if (event.type === "response.output_text.delta") output += event.delta ?? "";
          if (event.type === "response.failed" || event.type === "error") console.error("leitura IA falhou", raw.slice(0, 400));
        } catch { /* parcial */ }
      }
    }
    if (!output.trim()) throw new Error("Não deu para ler · preencha.");
    return output;
}

// ---------- E-mail da agência: só o que o app precisa, nunca preços/pagamento ----------
const segSchema = {
  type: "object", additionalProperties: false,
  properties: {
    tipo: { type: "string", enum: ["voo", "trem", "onibus"] }, companhia: s, numero: s, localizador: s,
    origem_iata: s, destino_iata: s, origem_cidade: s, destino_cidade: s, inicio: s, fim: s,
    bagagem: BAG_SCHEMA,
    passageiros: { type: "array", items: { type: "object", additionalProperties: false, properties: { nome: { type: "string" }, assento: s, eticket: s }, required: ["nome", "assento", "eticket"] } },
  },
  required: ["tipo", "companhia", "numero", "localizador", "origem_iata", "destino_iata", "origem_cidade", "destino_cidade", "inicio", "fim", "bagagem", "passageiros"],
};
const emailSchema = { type: "object", additionalProperties: false, properties: { trechos: { type: "array", items: segSchema } }, required: ["trechos"] };
const trechoZ = z.object({
  tipo: z.enum(["voo", "trem", "onibus"]), companhia: z.string().nullable(), numero: z.string().nullable(), localizador: z.string().nullable(),
  origem_iata: z.string().nullable(), destino_iata: z.string().nullable(), origem_cidade: z.string().nullable(), destino_cidade: z.string().nullable(),
  inicio: z.string().nullable(), fim: z.string().nullable(), bagagem: bagZ,
  passageiros: z.array(z.object({ nome: z.string(), assento: z.string().nullable(), eticket: z.string().nullable() })),
});
export type Trecho = z.infer<typeof trechoZ>;

/** Remove qualquer coisa com cara de dinheiro ou cartão que tenha escapado num campo de texto. */
function limpar(v: string | null): string | null {
  if (!v) return v;
  if (/(R\$|US\$|€|£|\b(BRL|USD|EUR|GBP)\s?\d)|\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b|tarifa|taxa|comiss|parcela|cart[aã]o/i.test(v)) return null;
  return v;
}

export const lerEmailAgencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data }): Promise<{ trechos: Trecho[] }> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("A leitura automática não está configurada.");
    if (!data.texto?.trim() && !data.arquivo) throw new Error("Cole o e-mail ou escolha um arquivo.");
    const instr = [
      "Este é um bilhete/e-mail/print de reserva de transporte. Liste TODOS os trechos (ida, volta e cada conexão), um item por voo/trem — leia o documento inteiro, inclusive todas as páginas. Para cada trecho preencha companhia, número do voo (ex.: LA 8084), aeroportos de origem e destino (código IATA de 3 letras; deduza pela cidade/aeroporto escrito se o código não aparecer), partida e chegada com data e hora. O mesmo localizador e os mesmos passageiros valem para todos os trechos da reserva.",
      "Extraia SOMENTE: companhia, número, localizador, aeroportos IATA, cidades, partida e chegada, passageiros (nome como no bilhete, assento, e-ticket) e franquia de bagagem.",
      "Localizador: use SEMPRE o código de reserva da companhia aérea (airline record locator / PNR da cia, ex.: DLPDCU); se houver também um código da agência (booking reference da agência), ignore-o.",
      "IGNORE totalmente preços, tarifas, taxas, impostos, comissão da agência, formas de pagamento, cartões e parcelas: não copie nada disso para nenhum campo.",
      "Datas: ISO local YYYY-MM-DDTHH:mm na hora do aeroporto. Não adivinhe: ausente = null. Nomes como 'Nome Sobrenome'.",
    ].join(" ");
    const content: Record<string, unknown>[] = [{ type: "input_text", text: instr }];
    if (data.texto?.trim()) content.push({ type: "input_text", text: data.texto.trim() });
    if (data.arquivo && data.mime?.startsWith("image/")) content.push({ type: "input_image", image_url: data.arquivo });
    if (data.arquivo && data.mime === "application/pdf") content.push({ type: "input_file", filename: data.nome ?? "email.pdf", file_data: data.arquivo });
    const out = z.object({ trechos: z.array(trechoZ) }).parse(JSON.parse(await chamarIA(key, content, "email_agencia", emailSchema)));
    return {
      trechos: out.trechos.map((t) => ({
        ...t, companhia: limpar(t.companhia), origem_cidade: limpar(t.origem_cidade), destino_cidade: limpar(t.destino_cidade),
        passageiros: t.passageiros.map((p) => ({ ...p, nome: limpar(p.nome) ?? "" })).filter((p) => p.nome),
      })),
    };
  });

// ---------- Uma entrada só: lê TODOS os itens (vários voos, hotel, trem, carro, passeio) de uma vez ----------
const tudoSchema = { type: "object", additionalProperties: false, properties: { itens: { type: "array", items: schema } }, required: ["itens"] };

export const lerTudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data }): Promise<{ itens: Leitura[] }> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("A leitura automática não está configurada.");
    if (!data.texto?.trim() && !data.arquivo) throw new Error("Cole um texto ou escolha um arquivo.");
    const instr = [
      "Este conteúdo pode ter VÁRIAS reservas de viagem. Liste TODOS os itens encontrados, um por elemento: cada trecho de voo/trem/ônibus separado (ida, volta e conexões), cada hotel, cada aluguel de carro, passeio, ingresso ou restaurante.",
      "Não adivinhe: campo ausente = null, lista ausente = []. Não liste despesas nem recibos. IGNORE cartões de crédito, parcelas e formas de pagamento.",
      "Datas: ISO local YYYY-MM-DDTHH:mm (hora do lugar), data simples YYYY-MM-DD. Moeda ISO 4217. IATA com 3 letras.",
      "Localizador de voo: use SEMPRE o código de reserva da companhia aérea (airline record locator / PNR da cia); se houver também um código da agência, ignore-o.",
      "Hotel: titulo = nome do hotel, local = endereço, inicio = check-in, fim = check-out. Nomes de pessoas como 'Nome Sobrenome'.",
    ].join(" ");
    const content: Record<string, unknown>[] = [{ type: "input_text", text: instr }];
    if (data.texto?.trim()) content.push({ type: "input_text", text: data.texto.trim() });
    if (data.arquivo && data.mime?.startsWith("image/")) content.push({ type: "input_image", image_url: data.arquivo });
    if (data.arquivo && data.mime === "application/pdf") content.push({ type: "input_file", filename: data.nome ?? "reserva.pdf", file_data: data.arquivo });
    const out = z.object({ itens: z.array(saida) }).parse(JSON.parse(await chamarIA(key, content, "reservas_viagem", tudoSchema)));
    return { itens: out.itens.filter((i) => i.tipo !== "despesa") };
  });
