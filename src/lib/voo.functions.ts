import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { atualizarTicket, type TicketVoo } from "./voo.server";

export const atualizarStatusVoo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ticket_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Lido como o próprio usuário: só funciona se ele puder ver o ticket.
    const { data: t } = await context.supabase
      .from("ticket")
      .select("id,trip_id,tipo,companhia,numero,origem_iata,destino_iata,partida_utc,partida_tz,chegada_utc")
      .eq("id", data.ticket_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!t) return { status: null, aviso: "Voo não encontrado." };
    if (t.tipo !== "voo") return { status: null, aviso: "Este bilhete não é de voo." };
    const r = await atualizarTicket(t as TicketVoo, "manual");
    return { status: r.status, aviso: r.aviso ?? null, daCache: !!r.daCache, numero: r.numero ?? null };
  });
