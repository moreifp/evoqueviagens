import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { adminClient, cifrar, decifrar, sha256Hex } from "./cadastro.server";

const TRINTA_DIAS = 30 * 86400_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function exigirAdmin(context: { supabase: any; claims: any }) {
  const email = String(context.claims?.email ?? "").toLowerCase();
  const { data } = await context.supabase.from("app_admin").select("email").ilike("email", email).maybeSingle();
  if (!data) throw new Error("Forbidden");
  return email;
}

function tokenNovo() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Link estável: reusa o mesmo token (nunca revoga nada), só estende a validade para 30 dias. */
export const linkEstavel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ personId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const email = await exigirAdmin(context);
    const db = await adminClient();
    const expira = new Date(Date.now() + TRINTA_DIAS).toISOString();
    const { data: links } = await db
      .from("cadastro_link")
      .select("id, token_cifrado, token_hash")
      .eq("person_id", data.personId)
      .is("revogado_em", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    // links antigos (só hash) continuam valendo: estende a validade deles também
    if (links?.length) await db.from("cadastro_link").update({ expira_em: expira }).in("id", links.map((l) => l.id));
    for (const l of links ?? []) {
      if (!l.token_cifrado) continue;
      const token = await decifrar(l.token_cifrado).catch(() => null);
      if (token && (await sha256Hex(token)) === l.token_hash) return { token };
    }
    const token = tokenNovo();
    const { error } = await db.from("cadastro_link").insert({
      person_id: data.personId,
      token_hash: await sha256Hex(token),
      token_cifrado: await cifrar(token),
      expira_em: expira,
      criado_por: email,
    });
    if (error) throw new Error("FALHA");
    return { token };
  });

/** Cancela o link da pessoa (ação explícita do admin). O próximo envio cria um link novo. */
export const cancelarLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ personId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const db = await adminClient();
    await db
      .from("cadastro_link")
      .update({ revogado_em: new Date().toISOString() })
      .eq("person_id", data.personId)
      .is("revogado_em", null);
    return { ok: true };
  });
