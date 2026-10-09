import { createFileRoute } from "@tanstack/react-router";
import { APOS_POUSO_MS, DURACAO_MAX_MS, TETO_JOB, UNIDADES_POR_CHAMADA, cancelado, chaveVoo, ehAVez, mesAtual } from "@/lib/voo";
import { consultarVoo, gravarStatus, type TicketVoo } from "@/lib/voo.server";

type Ultimo = { ticket_id: string; consultado_em: string; status: string | null; partida_real_utc: string | null; partida_revista_utc: string | null; chegada_real_utc: string | null; chegada_revista_utc: string | null } & Record<string, unknown>;

export const Route = createFileRoute("/api/public/hooks/status-voos")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get("authorization") ?? "")?.[1];
        if (!token) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const { data: ok } = await db.rpc("verificar_cron_voos", { _t: token });
        if (!ok) return new Response("Unauthorized", { status: 401 });
        const agora = Date.now();
        // Voo fica na consulta até 1 h depois do pouso. No banco filtra só pela partida (com folga do voo
        // mais longo + atraso); o corte fino pela chegada é feito abaixo, já com a chegada revista.
        const { data: tickets } = await db
          .from("ticket")
          .select("id,trip_id,tipo,companhia,numero,origem_iata,destino_iata,partida_utc,partida_tz,chegada_utc,trip:trip_id!inner(deleted_at)")
          .eq("tipo", "voo")
          .is("deleted_at", null)
          .is("trip.deleted_at", null)
          .gte("partida_utc", new Date(agora - DURACAO_MAX_MS - 6 * 3600_000).toISOString())
          .lte("partida_utc", new Date(agora + 30 * 3600_000).toISOString());
        const chegadaDoBilhete = (t: TicketVoo) => (t.chegada_utc ? Date.parse(t.chegada_utc) : Date.parse(t.partida_utc) + DURACAO_MAX_MS);
        // Corte grosso antes de ler status: chegada do bilhete + 1 h + até 6 h de atraso já pousou há tempo.
        const lista = ((tickets ?? []) as TicketVoo[]).filter((t) => chegadaDoBilhete(t) + APOS_POUSO_MS + 6 * 3600_000 >= agora);
        // Nenhum voo na janela: sai sem ler mais nada.
        if (!lista.length) return Response.json({ ok: true, consultados: 0 });

        // Último status de cada bilhete, numa consulta só (linha inteira: serve para os avisos push).
        const { data: status } = await db
          .from("flight_status")
          .select("*")
          .in("ticket_id", lista.map((t) => t.id))
          .order("consultado_em", { ascending: false })
          .limit(lista.length * 20);
        const ultimo = new Map<string, Ultimo>();
        for (const s of (status ?? []) as Ultimo[]) if (!ultimo.has(s.ticket_id)) ultimo.set(s.ticket_id, s);

        // Agrupa por voo (companhia + número + data local): 1 chamada por voo, gravada em todos os bilhetes.
        const grupos = new Map<string, TicketVoo[]>();
        for (const t of lista) {
          const k = chaveVoo(t) ?? `bilhete:${t.id}`;
          grupos.set(k, [...(grupos.get(k) ?? []), t]);
        }

        const mes = mesAtual();
        let uso: { unidades: number; aviso_em: string | null } | null | undefined; // lido uma vez, só se precisar
        let consultados = 0;
        for (const grupo of grupos.values()) {
          const t = grupo[0]!;
          // É a vez se qualquer bilhete do voo estiver na hora (usa a consulta mais recente do grupo).
          const recente = grupo.map((g) => ultimo.get(g.id)).filter((u): u is Ultimo => !!u).sort((a, b) => b.consultado_em.localeCompare(a.consultado_em))[0];
          // Cancelado: não gasta mais consultas com ele.
          if (cancelado(recente)) continue;
          const revista = recente?.chegada_real_utc ?? recente?.chegada_revista_utc;
          const chegada = revista ? Date.parse(revista) : chegadaDoBilhete(t);
          if (agora > chegada + APOS_POUSO_MS) continue; // já pousou há mais de 1 h
          const partida = Date.parse(recente?.partida_real_utc ?? recente?.partida_revista_utc ?? t.partida_utc);
          if (!ehAVez(partida, chegada, recente ? Date.parse(recente.consultado_em) : null, agora)) continue;

          if (uso === undefined) {
            const { data } = await db.from("api_usage").select("unidades,aviso_em").eq("mes", mes).maybeSingle();
            uso = data ?? { unidades: 0, aviso_em: null };
          }
          if ((uso?.unidades ?? 0) + UNIDADES_POR_CHAMADA > TETO_JOB) {
            if (!uso?.aviso_em) {
              await db.from("api_usage").update({ aviso_em: new Date().toISOString() }).eq("mes", mes);
              const trips = [...new Set(lista.map((x) => x.trip_id))];
              await db.from("api_alerta").insert(
                trips.map((trip_id) => ({
                  trip_id,
                  mensagem: 'As atualizações automáticas de voo pararam este mês (limite do plano). Use "Ver status" ou "Atualizar agora".',
                })),
              );
            }
            return Response.json({ ok: true, parado: "limite", consultados });
          }

          const c = await consultarVoo(db, t, "auto");
          consultados++;
          if (uso) uso = { ...uso, unidades: uso.unidades + UNIDADES_POR_CHAMADA };
          if (!c.linha) continue;
          for (const b of grupo) {
            const antes = (ultimo.get(b.id) ?? null) as Record<string, unknown> | null;
            const salvo = await gravarStatus(db, b.id, c.linha);
            // Avisa os passageiros se o voo atrasou, mudou de portão, foi cancelado ou abriu embarque.
            if (salvo) {
              try {
                const { gatilhoVoo } = await import("@/lib/push.gatilhos.server");
                await gatilhoVoo(b.id, antes, salvo as unknown as Record<string, unknown>);
              } catch (e) {
                console.error("gatilhoVoo", e);
              }
            }
          }
        }
        return Response.json({ ok: true, consultados, voos: grupos.size });
      },
    },
  },
});
