/**
 * Google Drive do organizador, só no servidor.
 *
 * Estrutura: Viagens/<nome da viagem>/<Fotos | Passagens | Hospedagem | Reservas | Despesas>/
 * (a subpasta Restaurants é criada pelo Evoque Restaurants dentro da mesma pasta da viagem).
 * Pastas de viagem que ficaram na raiz do Drive (versões antigas) são movidas para
 * dentro de Viagens/ na primeira vez em que são usadas.
 */
import { tokenDrive } from "./google-auth.server";

const GW = "https://www.googleapis.com";
const PASTA = "application/vnd.google-apps.folder";
export const RAIZ = "Viagens";

export type Subpasta = "Fotos" | "Passagens" | "Hospedagem" | "Reservas" | "Despesas";

export const SUBPASTA_POR_ITEM: Record<string, Subpasta> = {
  ticket: "Passagens",
  lodging: "Hospedagem",
  reservation: "Reservas",
};

async function cab() {
  return { Authorization: `Bearer ${await tokenDrive()}` };
}

async function checar<T = Record<string, unknown>>(r: Response, oque: string): Promise<T> {
  if (!r.ok) {
    const t = await r.text();
    console.error(`Drive ${oque} [${r.status}]: ${t.slice(0, 400)}`);
    throw new Error(`Google Drive recusou (${r.status}).`);
  }
  return (await r.json()) as T;
}

const q = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

/** Nome de pasta/arquivo sem caracteres que o Drive ou o Mac rejeitam. */
export function nomeSeguro(s: string | null | undefined, padrao = "Viagem") {
  return ((s ?? "").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim() || padrao).slice(0, 120);
}

type Achado = { id: string; parents?: string[] };

async function acharPasta(nome: string, pai: string | null): Promise<Achado | null> {
  const filtro = `name='${q(nome)}' and mimeType='${PASTA}' and trashed=false` + (pai ? ` and '${q(pai)}' in parents` : "");
  const r = await checar<{ files?: Achado[] }>(
    await fetch(`${GW}/drive/v3/files?q=${encodeURIComponent(filtro)}&fields=files(id,parents)&pageSize=5&orderBy=createdTime`, { headers: await cab() }),
    "busca pasta",
  );
  return r.files?.[0] ?? null;
}

async function criarPasta(nome: string, pai: string): Promise<string> {
  const r = await checar<{ id: string }>(
    await fetch(`${GW}/drive/v3/files?fields=id`, {
      method: "POST",
      headers: { ...(await cab()), "Content-Type": "application/json" },
      body: JSON.stringify({ name: nome, mimeType: PASTA, parents: [pai] }),
    }),
    "criar pasta",
  );
  return r.id;
}

async function mover(id: string, de: string[], para: string) {
  const r = await fetch(`${GW}/drive/v3/files/${id}?addParents=${para}&removeParents=${de.join(",")}&fields=id`, {
    method: "PATCH",
    headers: { ...(await cab()), "Content-Type": "application/json" },
    body: "{}",
  });
  if (!r.ok) console.error(`Drive mover [${r.status}]: ${(await r.text()).slice(0, 300)}`);
}

let raizCache: { id: string; em: number } | null = null;

/** Pasta "Viagens" na raiz do Drive (cria se não houver). */
export async function pastaRaiz(): Promise<string> {
  if (raizCache && Date.now() - raizCache.em < 10 * 60_000) return raizCache.id;
  const achou = await acharPasta(RAIZ, "root");
  const id = achou?.id ?? (await criarPasta(RAIZ, "root"));
  raizCache = { id, em: Date.now() };
  return id;
}

/**
 * Pasta da viagem dentro de Viagens/. Se já existir uma pasta com esse nome em outro
 * lugar (raiz, de versões antigas, ou criada pelo Restaurants), ela é movida para Viagens/.
 */
export async function pastaViagem(nomeViagem: string): Promise<{ id: string; nome: string }> {
  const nome = nomeSeguro(nomeViagem);
  const raiz = await pastaRaiz();
  const dentro = await acharPasta(nome, raiz);
  if (dentro) return { id: dentro.id, nome };
  const fora = await acharPasta(nome, null);
  if (fora) {
    const pais = fora.parents ?? [];
    if (!pais.includes(raiz)) await mover(fora.id, pais, raiz);
    return { id: fora.id, nome };
  }
  return { id: await criarPasta(nome, raiz), nome };
}

/** Subpasta (Fotos, Passagens…) dentro da pasta da viagem. */
export async function subpasta(pastaViagemId: string, nome: Subpasta): Promise<string> {
  const achou = await acharPasta(nome, pastaViagemId);
  return achou?.id ?? (await criarPasta(nome, pastaViagemId));
}

/** Já existe arquivo com esse nome na pasta? (tentativa anterior que não gravou no banco) */
async function arquivoExistente(nome: string, pai: string): Promise<string | null> {
  const filtro = `name='${q(nome)}' and '${q(pai)}' in parents and trashed=false`;
  const r = await checar<{ files?: { id: string; size?: string }[] }>(
    await fetch(`${GW}/drive/v3/files?q=${encodeURIComponent(filtro)}&fields=files(id,size)&pageSize=1`, { headers: await cab() }),
    "busca arquivo",
  );
  const f = r.files?.[0];
  // Arquivo vazio de uma tentativa falha não conta: será regravado por cima.
  return f && Number(f.size ?? 0) > 0 ? f.id : null;
}

/** Envia bytes para uma pasta. Um arquivo vazio nunca é gravado. Devolve o id no Drive. */
export async function enviarArquivo(opts: { pastaId: string; nome: string; mime: string; bytes: ArrayBuffer | Uint8Array; descricao?: string }): Promise<string> {
  const tamanho = opts.bytes.byteLength;
  if (tamanho === 0) throw new Error("Arquivo vazio não vai ao Drive.");
  const existente = await arquivoExistente(opts.nome, opts.pastaId);
  if (existente) return existente;
  const limite = "evoque" + crypto.randomUUID();
  const meta = JSON.stringify({ name: opts.nome, parents: [opts.pastaId], description: opts.descricao ?? "" });
  const corpo = new Blob([
    `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${limite}\r\nContent-Type: ${opts.mime}\r\n\r\n`,
    opts.bytes as BlobPart,
    `\r\n--${limite}--`,
  ]);
  const r = await checar<{ id: string }>(
    await fetch(`${GW}/upload/drive/v3/files?uploadType=multipart&fields=id`, {
      method: "POST",
      headers: { ...(await cab()), "Content-Type": `multipart/related; boundary=${limite}` },
      body: corpo,
    }),
    "enviar arquivo",
  );
  return r.id;
}

/** Extensão a partir do tipo ou do nome. */
export function extensao(nome: string | null | undefined, mime: string | null | undefined) {
  const doNome = (nome ?? "").match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
  if (doNome) return doNome;
  const m = (mime ?? "").toLowerCase();
  if (m.includes("pdf")) return "pdf";
  if (m.includes("png")) return "png";
  if (m.includes("heic")) return "heic";
  if (m.includes("webp")) return "webp";
  if (m.includes("rfc822") || m.includes("eml")) return "eml";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  return "bin";
}
