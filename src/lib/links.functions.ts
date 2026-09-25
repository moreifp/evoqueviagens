import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { adminClient } from "./cadastro.server";

/** Cancela o convite pendente de um pré-cadastro seu. O próximo envio cria um link novo. */
export const cancelarLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ personId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminClient();
    const { data: p } = await db.from("person").select("account_id").eq("id", data.personId).maybeSingle();
    if (!p || p.account_id !== context.userId) throw new Error("Forbidden");
    await db.from("share_invite").delete().eq("person_id", data.personId).eq("from_id", context.userId).is("usado_em", null);
    await db.from("cadastro_link").update({ revogado_em: new Date().toISOString() }).eq("person_id", data.personId).is("revogado_em", null);
    return { ok: true };
  });
