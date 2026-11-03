/**
 * Chamadas à API da Anthropic (Claude), só no servidor.
 * Substitui o gateway de IA do Lovable. A chave fica no segredo ANTHROPIC_API_KEY.
 */

/** Leitura de reservas e bilhetes em PDF ou foto (mais precisão). */
export const MODELO_RESERVAS = "claude-sonnet-5-5";
/** Leitura de documentos (passaporte, CNH, RG, vistos), recibos, despesas e reservas em texto/e-mail (rápido e barato). */
export const MODELO_DOCUMENTOS = "claude-haiku-4-5-20251001";

const API = "https://api.anthropic.com/v1/messages";

/**
 * Os modelos da geração 5 (Sonnet/Opus 5.x) não aceitam `temperature` nem
 * `tool_choice` forçado. Neles a ferramenta vai em modo "auto" com instrução de sistema.
 */
function geracao5(modelo: string): boolean {
  return /^claude-(sonnet|opus|fable)-5/.test(modelo);
}

export type Bloco =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

/** Converte um data URL (data:image/jpeg;base64,...) ou base64 puro em bloco de imagem/PDF. */
export function blocoArquivo(arquivo: string, mime: string | null | undefined): Bloco | null {
  const m = /^data:([^;,]+)?(?:;base64)?,(.*)$/s.exec(arquivo);
  const tipo = (m?.[1] || mime || "").toLowerCase();
  const dados = (m ? (m[2] ?? "") : arquivo).replace(/\s/g, "");
  if (!dados) return null;
  if (tipo === "application/pdf") return { type: "document", source: { type: "base64", media_type: "application/pdf", data: dados } };
  if (/^image\/(jpeg|png|webp|gif)$/.test(tipo)) return { type: "image", source: { type: "base64", media_type: tipo, data: dados } };
  if (tipo.startsWith("image/")) return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: dados } };
  return null;
}

function chave(): string {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new Error("A leitura automática não está configurada.");
  return key;
}

function mensagemErro(status: number, corpo: string): string {
  if (status === 429 || status === 529) return "A leitura está ocupada agora. Tente de novo em instantes.";
  if (status === 413) return "Arquivo grande demais para ler. Tente uma foto ou um PDF menor.";
  try {
    const j = JSON.parse(corpo) as { error?: { message?: string } };
    if (j.error?.message?.toLowerCase().includes("credit")) return "A leitura automática está sem crédito. Avise o administrador.";
  } catch { /* ignora */ }
  return `A leitura falhou (${status}).`;
}

async function enviar(body: Record<string, unknown>): Promise<{ content: Array<{ type: string; text?: string; name?: string; input?: unknown }>; stop_reason?: string }> {
  const response = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": chave(), "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const corpo = await response.text();
    console.error(`leitura IA [${response.status}]: ${corpo.slice(0, 400)}`);
    throw new Error(mensagemErro(response.status, corpo));
  }
  return response.json();
}

/**
 * Pede uma resposta estruturada: o modelo é obrigado a "chamar" a ferramenta `nome`
 * cujo input segue `schema` (JSON Schema). Devolve o objeto, com campos faltantes
 * preenchidos (null / []) para que o mesmo validador zod de antes continue valendo.
 */
export async function lerEstruturado(opts: {
  modelo: string;
  conteudo: Bloco[];
  nome: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<unknown> {
  const novo = geracao5(opts.modelo);
  const r = await enviar({
    model: opts.modelo,
    max_tokens: opts.maxTokens ?? 8000,
    ...(novo
      ? {
          system: `Responda chamando a ferramenta ${opts.nome} exatamente uma vez, com todos os dados extraídos. Não escreva texto fora da ferramenta.`,
          tool_choice: { type: "auto" },
        }
      : { temperature: 0, tool_choice: { type: "tool", name: opts.nome } }),
    tools: [{ name: opts.nome, description: "Devolve os dados extraídos no formato exato do esquema.", input_schema: semNullEmEnum(opts.schema) }],
    messages: [{ role: "user", content: opts.conteudo }],
  });
  const uso = r.content.find((c) => c.type === "tool_use" && c.name === opts.nome);
  if (!uso?.input) throw new Error("Não deu para ler · preencha.");
  return preencher(opts.schema, uso.input);
}

/** Pede texto livre (transcrição de MRZ, recibo). */
export async function lerTexto(opts: { modelo: string; conteudo: Bloco[]; maxTokens?: number }): Promise<string> {
  const r = await enviar({
    model: opts.modelo,
    max_tokens: opts.maxTokens ?? 4000,
    ...(geracao5(opts.modelo) ? {} : { temperature: 0 }),
    messages: [{ role: "user", content: opts.conteudo }],
  });
  const texto = r.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim();
  if (!texto) throw new Error("Não deu para ler · preencha.");
  return texto;
}

/** Pede um objeto JSON livre (sem esquema fixo), extraído do texto da resposta. */
export async function lerJsonLivre(opts: { modelo: string; conteudo: Bloco[]; maxTokens?: number }): Promise<unknown> {
  const texto = await lerTexto(opts);
  const ini = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (ini < 0 || fim <= ini) throw new Error("Não deu para ler · preencha.");
  return JSON.parse(texto.slice(ini, fim + 1));
}

type Schema = { type?: string | string[]; properties?: Record<string, Schema>; items?: Schema; required?: string[]; enum?: unknown[] };

/** A API de ferramentas não precisa de `null` dentro de `enum`; o tipo ["string","null"] já cobre. */
function semNullEmEnum(s: Record<string, unknown>): Record<string, unknown> {
  const copia = JSON.parse(JSON.stringify(s)) as Schema;
  const anda = (n: Schema | undefined) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n.enum)) n.enum = n.enum.filter((v) => v !== null);
    if (n.properties) Object.values(n.properties).forEach(anda);
    if (n.items) anda(n.items);
  };
  anda(copia);
  return copia as Record<string, unknown>;
}

/** Completa o que o modelo deixou de fora: campos ausentes viram null (ou [] para listas). */
function preencher(s: Schema, v: unknown): unknown {
  const tipos = Array.isArray(s.type) ? s.type : s.type ? [s.type] : [];
  const aceitaNull = tipos.includes("null");
  if (v === undefined || v === null) {
    if (tipos.includes("array") && !aceitaNull) return [];
    return aceitaNull || !tipos.length ? null : v ?? null;
  }
  if (tipos.includes("array") && Array.isArray(v)) return s.items ? v.map((i) => preencher(s.items!, i)) : v;
  if (tipos.includes("object") && typeof v === "object" && !Array.isArray(v) && s.properties) {
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, sub] of Object.entries(s.properties)) out[k] = preencher(sub, o[k]);
    return out;
  }
  if (tipos.includes("number") && typeof v === "string") {
    const n = Number(v.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : aceitaNull ? null : v;
  }
  if (Array.isArray(s.enum) && !s.enum.includes(v)) return aceitaNull ? null : v;
  return v;
}
