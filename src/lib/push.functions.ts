import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Registra (ou reativa) o aparelho atual para receber avisos. */
export const registrarAparelho = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ token: z.string().min(20), plataforma: z.string().max(20), userAgent: z.string().max(200) }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_device").upsert(
      { token: data.token, account_id: context.userId, plataforma: data.plataforma, user_agent: data.userAgent, ativo: true, visto_em: new Date().toISOString() },
      { onConflict: "token" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Desliga os avisos neste aparelho (ao sair da conta ou por escolha). */
export const removerAparelho = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ token: z.string().min(20) }).parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase.from("push_device").delete().eq("token", data.token).eq("account_id", context.userId);
    return { ok: true };
  });

export const salvarPrefPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      voo: z.boolean(), aviso: z.boolean(), convite: z.boolean(), claude: z.boolean(),
      documento: z.boolean(), checkin: z.boolean(),
      silencio_inicio: z.string().regex(/^\d{2}:\d{2}$/), silencio_fim: z.string().regex(/^\d{2}:\d{2}$/),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_pref").upsert({ account_id: context.userId, ...data, atualizado_em: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Manda um aviso de teste real para o aparelho da própria pessoa. */
export const avisoTeste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { enviarAviso } = await import("./push.server");
    return enviarAviso({
      accountId: context.userId, tipo: "teste",
      titulo: "Viagens Organizadas", corpo: "Avisos ligados neste aparelho. Tudo certo!",
      url: "/", furarSilencio: true,
    });
  });

/** Roda os gatilhos em modo simulação (só grava no push_log). Uso de teste. */
export const simularGatilhos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ ticketId: z.string().uuid().optional(), noticeId: z.string().uuid().optional(), memberId: z.string().uuid().optional() }).parse(data))
  .handler(async ({ data, context }) => {
    const g = await import("./push.gatilhos.server");
    const r: { voo: boolean; aviso: boolean; convite: boolean; claude: boolean; documento: { avisos: number }; checkin: { avisos: number } } = {
      voo: false, aviso: false, convite: false, claude: false, documento: { avisos: 0 }, checkin: { avisos: 0 },
    };
    if (data.ticketId) {
      const { data: depois } = await context.supabase.from("flight_status").select("*").eq("ticket_id", data.ticketId).order("consultado_em", { ascending: false }).limit(1).maybeSingle();
      await g.gatilhoVoo(data.ticketId, null, (depois ?? { atraso_partida_min: 30, status: "Delayed" }) as Record<string, unknown>, true);
      r.voo = true;
    }
    if (data.noticeId) { await g.gatilhoAvisoOrganizador(data.noticeId, true); r.aviso = true; }
    if (data.memberId) { await g.gatilhoConvite(data.memberId, true); r.convite = true; }
    await g.gatilhoClaude(context.userId, true); r.claude = true;
    r.documento = await g.gatilhoDocumentos(true);
    r.checkin = await g.gatilhoCheckin(true);
    return r;
  });
