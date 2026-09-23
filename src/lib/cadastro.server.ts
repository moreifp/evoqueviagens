import type { SupabaseClient } from "@supabase/supabase-js";

export async function sha256Hex(texto: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
  const { data, error } = await db
    .from("cadastro_link")
    .select("id, person_id, expira_em, revogado_em, deleted_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (error || !data) throw new Error("LINK_INVALIDO");
  if (data.revogado_em || data.deleted_at) throw new Error("LINK_REVOGADO");
  if (new Date(data.expira_em).getTime() < Date.now()) throw new Error("LINK_EXPIRADO");
  const { data: p } = await db.from("person").select("id, deleted_at").eq("id", data.person_id).maybeSingle();
  if (!p || p.deleted_at) throw new Error("LINK_INVALIDO");
  await db.from("cadastro_link").update({ ultimo_acesso_em: new Date().toISOString() }).eq("id", data.id);
  return data.person_id as string;
}
