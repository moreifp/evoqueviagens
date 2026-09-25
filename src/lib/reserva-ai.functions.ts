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

const TIPOS = ["voo", "trem", "onibus", "hotel", "carro", "passeio", "restaurante", "outro", "despesa"] as const;
const s = { type: ["string", "null"] };

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    tipo: { type: "string", enum: [...TIPOS] },
    titulo: s, companhia: s, numero: s, localizador: s, origem_iata: s, destino_iata: s,
    origem_cidade: s, destino_cidade: s, inicio: s, fim: s, local: s, cidade: s,
    valor: { type: ["number", "null"] }, moeda: s, cancelamento_gratis_ate: s, politica_cancelamento: s,
    categoria: { type: ["string", "null"], enum: ["alimentacao", "hospedagem", "transporte", "passeios", "compras", "outros", null] },
    passageiros: {
      type: "array",
      items: { type: "object", additionalProperties: false, properties: { nome: { type: "string" }, assento: s, eticket: s }, required: ["nome", "assento", "eticket"] },
    },
    quartos: {
      type: "array",
      items: { type: "object", additionalProperties: false, properties: { nome: { type: "string" }, tipo: s, hospedes: { type: "array", items: { type: "string" } } }, required: ["nome", "tipo", "hospedes"] },
    },
    pessoas: { type: "array", items: { type: "string" } },
  },
  required: ["tipo", "titulo", "companhia", "numero", "localizador", "origem_iata", "destino_iata", "origem_cidade", "destino_cidade", "inicio", "fim", "local", "cidade", "valor", "moeda", "cancelamento_gratis_ate", "politica_cancelamento", "categoria", "passageiros", "quartos", "pessoas"],
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
});
export type Leitura = z.infer<typeof saida>;

const FOCO: Record<string, string> = {
  voo: "O usuário está cadastrando um voo/trem/ônibus: foque em companhia, número, IATA, horários e passageiros (nome como no bilhete, assento, e-ticket).",
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
    const run = gatewayFetch();
    const response = await run.fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true,
        input: [{ role: "user", content }],
        reasoning: { effort: "low", summary: "auto" }, store: false, include: ["reasoning.encrypted_content"],
        text: { format: { type: "json_schema", name: "reserva_viagem", strict: true, schema } },
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
    return saida.parse(JSON.parse(output));
  });
