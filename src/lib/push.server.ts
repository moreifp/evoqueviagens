/**
 * Envio de avisos push (servidor). Nunca chamar do cliente.
 * Usa o Firebase Cloud Messaging (HTTP v1) com a conta de serviço; em modo `simular`
 * só grava no push_log, sem mandar nada de verdade.
 */

import { tokenFcm } from "./google-auth.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

export type TipoAviso = "voo" | "aviso" | "convite" | "claude" | "documento" | "checkin" | "teste";

export type PedidoAviso = {
  accountId: string;
  tipo: TipoAviso;
  titulo: string;
  corpo: string;
  url?: string;
  refId?: string;
  /** Voo nas próximas 24h fura o horário de silêncio. */
  furarSilencio?: boolean;
  /** Só grava no push_log, sem chamar o FCM. */
  simular?: boolean;
};

const DEDUPE_HORAS: Partial<Record<TipoAviso, number>> = { documento: 24 * 7 };
const DEDUPE_PADRAO_HORAS = 6;

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function horaLocalSP(): number {
  const h = new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date());
  return Number(h) % 24;
}

function emSilencio(inicio: string, fim: string): boolean {
  const hi = Number(inicio.split(":")[0] ?? "22") || 0;
  const hf = Number(fim.split(":")[0] ?? "07") || 0;
  const h = horaLocalSP();
  return hi <= hf ? h >= hi && h < hf : h >= hi || h < hf;
}

async function registrarLog(db: Admin, p: PedidoAviso, status: string, erro?: string) {
  await db.from("push_log").insert({
    account_id: p.accountId, tipo: p.tipo, ref_id: p.refId ?? null,
    titulo: p.titulo.slice(0, 120), corpo: p.corpo.slice(0, 300), url: p.url ?? null,
    status, erro: erro?.slice(0, 300) ?? null,
  });
}

/**
 * Ponto único de envio. Respeita preferências, silêncio (22h–7h em São Paulo,
 * exceto voo nas próximas 24h) e dedupe (6h; documento: 7 dias).
 */
export async function enviarAviso(p: PedidoAviso): Promise<{ status: string }> {
  const db = await admin();

  const { data: pref } = await db.from("push_pref").select("*").eq("account_id", p.accountId).maybeSingle();
  if (pref && p.tipo !== "teste" && pref[p.tipo] === false) {
    await registrarLog(db, p, "pulado_pref");
    return { status: "pulado_pref" };
  }

  if (!p.furarSilencio && p.tipo !== "teste" && emSilencio(pref?.silencio_inicio ?? "22:00", pref?.silencio_fim ?? "07:00")) {
    await registrarLog(db, p, "pulado_silencio");
    return { status: "pulado_silencio" };
  }

  if (p.refId) {
    const horas = DEDUPE_HORAS[p.tipo] ?? DEDUPE_PADRAO_HORAS;
    const desde = new Date(Date.now() - horas * 3600_000).toISOString();
    const { data: ja } = await db
      .from("push_log").select("id")
      .eq("account_id", p.accountId).eq("tipo", p.tipo).eq("ref_id", p.refId)
      .in("status", ["enviado", "simulado"])
      .gte("enviado_em", desde).limit(1);
    if (ja?.length) {
      await registrarLog(db, p, "pulado_dedupe");
      return { status: "pulado_dedupe" };
    }
  }

  const { data: aparelhos } = await db.from("push_device").select("id,token").eq("account_id", p.accountId).eq("ativo", true);
  if (!aparelhos?.length) {
    await registrarLog(db, p, "sem_aparelho");
    return { status: "sem_aparelho" };
  }

  if (p.simular) {
    await registrarLog(db, p, "simulado");
    return { status: "simulado" };
  }

  let fcm: { token: string; projeto: string };
  try {
    fcm = await tokenFcm();
  } catch (e) {
    await registrarLog(db, p, "erro", e instanceof Error ? e.message : "Firebase não configurado");
    return { status: "erro" };
  }

  let enviados = 0;
  let ultimoErro: string | undefined;
  for (const ap of aparelhos as { id: string; token: string }[]) {
    try {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${fcm.projeto}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${fcm.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token: ap.token,
            notification: { title: p.titulo, body: p.corpo },
            data: { url: p.url ?? "/" },
            webpush: { fcmOptions: { link: `https://app.evoque.global${p.url ?? "/"}` } },
          },
        }),
      });
      if (res.ok) {
        enviados++;
        await db.from("push_device").update({ visto_em: new Date().toISOString() }).eq("id", ap.id);
      } else {
        const corpoRes = (await res.text()).slice(0, 300);
        console.error("fcm", res.status, corpoRes);
        ultimoErro = `FCM ${res.status}`;
        // SENDER_ID_MISMATCH: token do Firebase antigo (beatitudelumnia); o aparelho registra um novo ao abrir o app.
        if (corpoRes.includes("SENDER_ID_MISMATCH") || corpoRes.includes("UNREGISTERED") || corpoRes.includes("NOT_FOUND") || corpoRes.includes("INVALID_ARGUMENT") || res.status === 404) {
          await db.from("push_device").update({ ativo: false }).eq("id", ap.id);
        }
      }
    } catch (e) {
      console.error("fcm fetch", e);
      ultimoErro = "falha de rede";
    }
  }

  const status = enviados > 0 ? "enviado" : "erro";
  await registrarLog(db, p, status, ultimoErro);
  return { status };
}

/** Contas a avisar pelas pessoas de um bilhete: conta própria ou responsável do dependente. */
export async function contasDasPessoas(db: Admin, personIds: string[]): Promise<string[]> {
  if (!personIds.length) return [];
  const { data } = await db.from("person").select("account_id,owner_id,kind").in("id", personIds).is("deleted_at", null);
  const contas = new Set<string>();
  for (const p of (data ?? []) as { account_id: string | null; owner_id: string | null; kind: string }[]) {
    if (p.kind === "precadastro") continue;
    const conta = p.kind === "dependent" ? p.owner_id : p.account_id;
    if (conta) contas.add(conta);
  }
  return [...contas];
}
