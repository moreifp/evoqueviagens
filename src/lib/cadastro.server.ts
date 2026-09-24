import type { SupabaseClient } from "@supabase/supabase-js";

export async function sha256Hex(texto: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function chave() {
  const segredo = process.env["LINK_TOKEN_KEY"];
  if (!segredo) throw new Error("SEM_CHAVE");
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(segredo));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Token cifrado (AES-GCM) com segredo do servidor: "iv.cifra" em base64. */
export async function cifrar(texto: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await chave(), new TextEncoder().encode(texto));
  return `${b64(iv)}.${b64(new Uint8Array(c))}`;
}
export async function decifrar(s: string) {
  const [iv, c] = s.split(".");
  const p = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(iv!) }, await chave(), deB64(c!));
  return new TextDecoder().decode(p);
}

/** WhatsApp do admin que mandou o link (para o aviso de link vencido). */
export async function contatoDoLink(db: Admin, token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const { data } = await db.from("cadastro_link").select("criado_por").eq("token_hash", await sha256Hex(token)).maybeSingle();
  if (!data?.criado_por) return null;
  const { data: a } = await db.from("app_admin").select("telefone").ilike("email", data.criado_por).maybeSingle();
  return (a?.telefone as string | null) ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Admin = SupabaseClient<any>;

export async function adminClient(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Admin;
}

/** Valida o token (existe, não expirou, não revogado) e devolve o person_id. */
export async function validarToken(db: Admin, token: string): Promise<string> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) throw new Error("LINK_INVALIDO");
  const hash = await sha256Hex(token);
  async function buscarLink() {
    return db
      .from("cadastro_link")
      .select("id, person_id, expira_em, revogado_em, deleted_at")
      .eq("token_hash", hash)
      .maybeSingle();
  }
  let { data, error } = await buscarLink();
  if (error) ({ data, error } = await buscarLink());
  if (error) throw new Error("FALHA_CARREGAR");
  if (!data) throw new Error("LINK_INVALIDO");
  if (data.revogado_em || data.deleted_at) throw new Error("LINK_REVOGADO");
  if (new Date(data.expira_em).getTime() < Date.now()) throw new Error("LINK_EXPIRADO");
  async function buscarPessoa() {
    return db.from("person").select("id, deleted_at").eq("id", data.person_id).maybeSingle();
  }
  let { data: p, error: pessoaErro } = await buscarPessoa();
  if (pessoaErro) ({ data: p, error: pessoaErro } = await buscarPessoa());
  if (pessoaErro) throw new Error("FALHA_CARREGAR");
  if (!p || p.deleted_at) throw new Error("LINK_INVALIDO");
  await db.from("cadastro_link").update({ ultimo_acesso_em: new Date().toISOString() }).eq("id", data.id);
  return data.person_id as string;
}
