import { CACHE_MIN, LIMITE_MENSAL_UNIDADES, TETO_JOB, UNIDADES_POR_CHAMADA, chaveVoo, dataLocalPartida, ddmm, mesAtual, numeroVoo, statusDisponivelEm, type StatusVoo } from "./voo";

export type TicketVoo = {
  id: string; trip_id: string; tipo: string; companhia: string | null; numero: string | null;
  origem_iata: string | null; destino_iata: string | null; partida_utc: string; partida_tz: string; chegada_utc: string;
};

type Resultado = { status: StatusVoo | null; aviso?: string; daCache?: boolean; numero?: string | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function ultimoStatus(db: Admin, ticketId: string): Promise<StatusVoo | null> {
  const { data } = await db.from("flight_status").select("*").eq("ticket_id", ticketId).order("consultado_em", { ascending: false }).limit(1).maybeSingle();
  return (data as StatusVoo | null) ?? null;
}

const utc = (t?: { utc?: string } | null) => (t?.utc ? new Date(t.utc.replace(" ", "T")).toISOString() : null);
const diffMin = (a: string | null, b: string | null) => (a && b ? Math.round((Date.parse(a) - Date.parse(b)) / 60000) : null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function escolherTrecho(lista: any[], t: TicketVoo) {
  if (lista.length <= 1) return lista[0];
  const o = t.origem_iata?.toUpperCase(), d = t.destino_iata?.toUpperCase();
  return (
    lista.find((f) => f.departure?.airport?.iata === o && f.arrival?.airport?.iata === d) ??
    lista.find((f) => f.departure?.airport?.iata === o) ??
    lista.find((f) => f.arrival?.airport?.iata === d) ??
    lista[0]
  );
}

type Linha = Omit<StatusVoo, "id" | "ticket_id" | "consultado_em"> & { origem: string; payload_json: unknown };
type Consulta = { linha: Linha | null; aviso?: string; numero: string | null };

export const AVISO_LIMITE = "As atualizações de voo deste mês acabaram (limite do plano). Voltam no dia 1º.";

/** Uma chamada à AeroDataBox (só número + data), sem gravar. Serve para todos os bilhetes do mesmo voo.
 * `teto`: se informado, confere o uso do mês (api_usage) antes de chamar e não passa dele. */
export async function consultarVoo(db: Admin, t: TicketVoo, origem: "auto" | "manual", teto?: number): Promise<Consulta> {
  const numero = numeroVoo(t.companhia, t.numero);
  if (!numero) return { linha: null, aviso: "Não consegui identificar a companhia e o número deste voo.", numero };
  const data = dataLocalPartida(t.partida_utc, t.partida_tz);
  const aPartir = statusDisponivelEm(t.partida_utc, t.partida_tz);
  if (aPartir) return { linha: null, aviso: `O status aparece perto do voo (a partir de ${ddmm(aPartir)}).`, numero };
  const key = process.env["AERODATABOX_KEY"];
  if (!key) return { linha: null, aviso: "Não consegui atualizar agora.", numero };
  if (teto !== undefined) {
    const { data: uso } = await db.from("api_usage").select("unidades").eq("mes", mesAtual()).maybeSingle();
    if ((uso?.unidades ?? 0) + UNIDADES_POR_CHAMADA > teto) return { linha: null, aviso: AVISO_LIMITE, numero };
  }

  let res: Response;
  try {
    res = await fetch(`https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(numero)}/${data}?withAircraftImage=false&withLocation=false`, {
      headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com" },
    });
  } catch (e) {
    console.error("aerodatabox fetch", e);
    return { linha: null, aviso: "Não consegui atualizar agora.", numero };
  }
  // Toda resposta do servidor da API conta no plano, inclusive "não encontrado".
  if (res.ok || res.status === 404) await db.rpc("somar_uso_api", { _mes: mesAtual(), _n: UNIDADES_POR_CHAMADA });
  if (res.status === 204 || res.status === 404) return { linha: null, aviso: `Não encontrei o voo ${numero} em ${data.split("-").reverse().join("/")}.`, numero };
  if (!res.ok) {
    console.error("aerodatabox", res.status, (await res.text()).slice(0, 300));
    return { linha: null, aviso: "Não consegui atualizar agora.", numero };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lista = (await res.json().catch(() => [])) as any[];
  // Só aceita trechos cuja partida prevista cai na data local do bilhete (nunca o voo de outro dia).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doDia = Array.isArray(lista) ? lista.filter((x: any) => { const u = utc(x.departure?.scheduledTime); return !u || dataLocalPartida(u, t.partida_tz) === data; }) : [];
  const f = doDia.length ? escolherTrecho(doDia, t) : null;
  if (!f) return { linha: null, aviso: `Não encontrei o voo ${numero} nesta data.`, numero };

  const dep = f.departure ?? {}, arr = f.arrival ?? {};
  const pPrev = utc(dep.scheduledTime), pRev = utc(dep.revisedTime) ?? utc(dep.predictedTime), pReal = utc(dep.runwayTime) ?? utc(dep.actualTime);
  const cPrev = utc(arr.scheduledTime), cRev = utc(arr.revisedTime) ?? utc(arr.predictedTime), cReal = utc(arr.runwayTime) ?? utc(arr.actualTime);
  const linha = {
    origem, status: f.status ?? null,
    partida_prevista_utc: pPrev, partida_revista_utc: pRev, partida_real_utc: pReal,
    chegada_prevista_utc: cPrev, chegada_revista_utc: cRev, chegada_real_utc: cReal,
    terminal_partida: dep.terminal ?? null, portao_partida: dep.gate ?? null,
    terminal_chegada: arr.terminal ?? null, portao_chegada: arr.gate ?? null, esteira: arr.baggageBelt ?? null,
    atraso_partida_min: diffMin(pReal ?? pRev, pPrev), atraso_chegada_min: diffMin(cReal ?? cRev, cPrev),
    payload_json: f,
  } as Linha;
  return { linha, numero };
}

/** Grava o resultado de uma consulta para um bilhete. */
export async function gravarStatus(db: Admin, ticketId: string, linha: Linha): Promise<StatusVoo | null> {
  const { data: salvo, error } = await db.from("flight_status").insert({ ...linha, ticket_id: ticketId }).select("*").single();
  if (error) { console.error("flight_status insert", error); return null; }
  return salvo as StatusVoo;
}

/**
 * Status recente (< CACHE_MIN) de OUTRO bilhete do mesmo voo (companhia + número + dia local),
 * copiado para este bilhete. Assim várias pessoas no mesmo voo não gastam uma chamada cada.
 * O status de voo é dado público (sem nome, localizador ou e-mail), como no job automático.
 */
async function statusDoMesmoVoo(db: Admin, t: TicketVoo): Promise<StatusVoo | null> {
  const chave = chaveVoo(t);
  if (!chave) return null;
  const p = Date.parse(t.partida_utc), D = 86_400_000;
  const { data: irmaos } = await db
    .from("ticket")
    .select("id,companhia,numero,partida_utc,partida_tz")
    .eq("tipo", "voo")
    .is("deleted_at", null)
    .neq("id", t.id)
    .gte("partida_utc", new Date(p - D).toISOString())
    .lte("partida_utc", new Date(p + D).toISOString())
    .limit(200);
  const ids = ((irmaos ?? []) as (Parameters<typeof chaveVoo>[0] & { id: string })[])
    .filter((b) => chaveVoo(b) === chave)
    .map((b) => b.id);
  if (!ids.length) return null;
  const { data: recente } = await db
    .from("flight_status")
    .select("*")
    .in("ticket_id", ids)
    .gte("consultado_em", new Date(Date.now() - CACHE_MIN * 60_000).toISOString())
    .order("consultado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!recente) return null;
  // Mantém consultado_em original: a idade do dado continua honesta e o cache vale para os dois.
  const { id: _id, ticket_id: _tid, ...resto } = recente as StatusVoo & Record<string, unknown>;
  const { data: salvo, error } = await db.from("flight_status").insert({ ...resto, ticket_id: t.id }).select("*").single();
  if (error) { console.error("flight_status copiar", error); return recente as StatusVoo; }
  return salvo as StatusVoo;
}

/** Consulta a AeroDataBox (só número + data) e grava. Nunca envia nome, localizador ou e-mail. */
export async function atualizarTicket(t: TicketVoo, origem: "auto" | "manual", forcarCache = true): Promise<Resultado> {
  const db = await admin();
  const ultimo = await ultimoStatus(db, t.id);
  if (forcarCache && ultimo && Date.now() - Date.parse(ultimo.consultado_em) < CACHE_MIN * 60_000) return { status: ultimo, daCache: true };
  if (forcarCache) {
    const doVoo = await statusDoMesmoVoo(db, t);
    if (doVoo) return { status: doVoo, daCache: true };
  }
  // Manual pode usar o plano inteiro; o automático para antes (TETO_JOB) para sobrar para o manual.
  const c = await consultarVoo(db, t, origem, origem === "manual" ? LIMITE_MENSAL_UNIDADES : TETO_JOB);
  if (!c.linha) return { status: c.aviso?.startsWith("O status aparece") ? null : ultimo, aviso: c.aviso, numero: c.numero };
  const salvo = await gravarStatus(db, t.id, c.linha);
  if (!salvo) return { status: ultimo, aviso: "Não consegui atualizar agora.", numero: c.numero };
  return { status: salvo, numero: c.numero };
}
