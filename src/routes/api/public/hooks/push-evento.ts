import { createFileRoute } from "@tanstack/react-router";

/**
 * Recebe eventos dos gatilhos do banco (pg_net) e dispara os avisos push.
 * Mesmo esquema de segredo do cron de status de voo.
 */
export const Route = createFileRoute("/api/public/hooks/push-evento")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = /^Bearer ([a-f0-9]{64})$/.exec(
          request.headers.get("authorization") ?? "",
        )?.[1];
        if (!token) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const { data: ok } = await db.rpc("verificar_cron_voos", { _t: token });
        if (!ok) return new Response("Unauthorized", { status: 401 });

        let corpo: { tipo?: string; id?: string; account_id?: string };
        try {
          corpo = await request.json();
        } catch {
          return Response.json({ ok: false, erro: "json inválido" }, { status: 400 });
        }
        const g = await import("@/lib/push.gatilhos.server");
        try {
          switch (corpo.tipo) {
            case "aviso":
              if (corpo.id) await g.gatilhoAvisoOrganizador(corpo.id);
              break;
            case "convite":
              if (corpo.id) await g.gatilhoConvite(corpo.id);
              break;
            case "claude":
              if (corpo.account_id) await g.gatilhoClaude(corpo.account_id);
              break;
            default:
              return Response.json({ ok: false, erro: "tipo desconhecido" }, { status: 400 });
          }
        } catch (e) {
          console.error("push-evento", e);
          return Response.json({ ok: false }, { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
