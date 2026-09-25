/**
 * Ferramentas do agente como funções de servidor (futuras tools do MCP).
 * Todas exigem login e usam a sessão de quem chamou (permissões do banco valem).
 * Descrições para o agente: FERRAMENTAS_AGENTE em agente.tools.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { esquemaHospedagem, esquemaReserva, esquemaTrip, esquemaVoo } from "./agente.tools";
import { detalharViagem, listarParticipantes, listarViagens, proporHospedagem, proporReserva, proporVoo, rodarRevisao, type Ctx } from "./agente.server";

const ctx = (c: { supabase: unknown; userId: string }): Ctx => ({ supabase: c.supabase, userId: c.userId, origemUrl: getRequest().url });

export const listar_viagens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listarViagens(ctx(context)));

export const detalhar_viagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => esquemaTrip.parse(d))
  .handler(async ({ data, context }) => detalharViagem(ctx(context), data.trip_id));

export const listar_participantes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => esquemaTrip.parse(d))
  .handler(async ({ data, context }) => listarParticipantes(ctx(context), data.trip_id));

export const propor_voo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => esquemaVoo.parse(d))
  .handler(async ({ data, context }) => proporVoo(ctx(context), data));

export const propor_hospedagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => esquemaHospedagem.parse(d))
  .handler(async ({ data, context }) => proporHospedagem(ctx(context), data));

export const propor_reserva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => esquemaReserva.parse(d))
  .handler(async ({ data, context }) => proporReserva(ctx(context), data));

export const rodar_revisao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => esquemaTrip.parse(d))
  .handler(async ({ data, context }) => rodarRevisao(ctx(context), data.trip_id));
