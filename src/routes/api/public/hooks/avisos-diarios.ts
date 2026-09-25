import { createFileRoute } from "@tanstack/react-router";

/** Job diário: documentos vencendo antes de viagem marcada + lembretes de check-in. */
export const Route = createFileRoute("/api/public/hooks/avisos-diarios")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get("authorization") ?? "")?.[1];
        if (!token) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const { data: ok } = await db.rpc("verificar_cron_voos", { _t: token });
        if (!ok) return new Response("Unauthorized", { status: 401 });
        const g = await import("@/lib/push.gatilhos.server");
        const documentos = await g.gatilhoDocumentos();
        const checkin = await g.gatilhoCheckin();
        return Response.json({ ok: true, documentos, checkin });
      },
    },
  },
});
