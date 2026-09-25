import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { TETO_JOB, UNIDADES_POR_CHAMADA, ehAVez, mesAtual } from "@/lib/voo";
import { atualizarTicket, type TicketVoo } from "@/lib/voo.server";

export const Route = createFileRoute("/api/public/hooks/status-voos")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const negado = await authenticateCronRequest(request);
        if (negado) return negado;
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const agora = Date.now();
        const { data: tickets } = await db
          .from("ticket")
          .select("id,trip_id,tipo,companhia,numero,origem_iata,destino_iata,partida_utc,partida_tz,chegada_utc")
          .eq("tipo", "voo")
          .is("deleted_at", null)
          .gte("partida_utc", new Date(agora - 2 * 3600_000).toISOString())
          .lte("partida_utc", new Date(agora + 30 * 3600_000).toISOString());
        let consultados = 0;
        for (const t of (tickets ?? []) as TicketVoo[]) {
          const { data: ult } = await db.from("flight_status").select("consultado_em,chegada_real_utc,chegada_revista_utc").eq("ticket_id", t.id).order("consultado_em", { ascending: false }).limit(1).maybeSingle();
          const chegada = Date.parse(ult?.chegada_real_utc ?? ult?.chegada_revista_utc ?? t.chegada_utc);
          if (!ehAVez(Date.parse(t.partida_utc), chegada, ult ? Date.parse(ult.consultado_em) : null, agora)) continue;
          const mes = mesAtual();
          const { data: uso } = await db.from("api_usage").select("unidades,aviso_em").eq("mes", mes).maybeSingle();
          if ((uso?.unidades ?? 0) + UNIDADES_POR_CHAMADA > TETO_JOB) {
            if (!uso?.aviso_em) {
              await db.from("api_usage").update({ aviso_em: new Date().toISOString() }).eq("mes", mes);
              const trips = [...new Set(((tickets ?? []) as TicketVoo[]).map((x) => x.trip_id))];
              await db.from("api_alerta").insert(trips.map((trip_id) => ({ trip_id, mensagem: "As atualizações automáticas de voo pararam este mês (limite do plano). Use \"Ver status\" ou \"Atualizar agora\"." })));
            }
            return Response.json({ ok: true, parado: "limite", consultados });
          }
          await atualizarTicket(t, "auto", false);
          consultados++;
        }
        return Response.json({ ok: true, consultados });
      },
    },
  },
});
