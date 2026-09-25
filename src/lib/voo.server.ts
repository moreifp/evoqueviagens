import { CACHE_MIN, UNIDADES_POR_CHAMADA, dataLocalPartida, mesAtual, numeroVoo, type StatusVoo } from "./voo";

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

/** Consulta a AeroDataBox (só número + data) e grava. Nunca envia nome, localizador ou e-mail. */
export async function atualizarTicket(t: TicketVoo, origem: "auto" | "manual", forcarCache = true): Promise<Resultado> {
  const db = await admin();
  const ultimo = await ultimoStatus(db, t.id);
  if (forcarCache && ultimo && Date.now() - Date.parse(ultimo.consultado_em) < CACHE_MIN * 60_000) return { status: ultimo, daCache: true };

  const numero = numeroVoo(t.companhia, t.numero);
  if (!numero) return { status: ultimo, aviso: "Não consegui identificar a companhia e o número deste voo.", numero };
  const data = dataLocalPartida(t.partida_utc, t.partida_tz);
  const key = process.env["AERODATABOX_KEY"];
  if (!key) return { status: ultimo, aviso: "Não consegui atualizar agora.", numero };

  let res: Response;
  try {
    res = await fetch(`https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(numero)}/${data}?withAircraftImage=false&withLocation=false`, {
      headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com" },
    });
  } catch (e) {
    console.error("aerodatabox fetch", e);
    return { status: ultimo, aviso: "Não consegui atualizar agora.", numero };
  }
  // Toda resposta do servidor da API conta no plano, inclusive "não encontrado".
  if (res.ok || res.status === 404) await db.rpc("somar_uso_api", { _mes: mesAtual(), _n: UNIDADES_POR_CHAMADA });
  if (res.status === 204 || res.status === 404) return { status: ultimo, aviso: `Não encontrei o voo ${numero} em ${data.split("-").reverse().join("/")}.`, numero };
  if (!res.ok) {
    console.error("aerodatabox", res.status, (await res.text()).slice(0, 300));
    return { status: ultimo, aviso: "Não consegui atualizar agora.", numero };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lista = (await res.json().catch(() => [])) as any[];
  const f = Array.isArray(lista) ? escolherTrecho(lista, t) : null;
  if (!f) return { status: ultimo, aviso: `Não encontrei o voo ${numero} nesta data.`, numero };

  const dep = f.departure ?? {}, arr = f.arrival ?? {};
  const pPrev = utc(dep.scheduledTime), pRev = utc(dep.revisedTime) ?? utc(dep.predictedTime), pReal = utc(dep.runwayTime) ?? utc(dep.actualTime);
  const cPrev = utc(arr.scheduledTime), cRev = utc(arr.revisedTime) ?? utc(arr.predictedTime), cReal = utc(arr.runwayTime) ?? utc(arr.actualTime);
  const linha = {
    ticket_id: t.id, origem, status: f.status ?? null,
    partida_prevista_utc: pPrev, partida_revista_utc: pRev, partida_real_utc: pReal,
    chegada_prevista_utc: cPrev, chegada_revista_utc: cRev, chegada_real_utc: cReal,
    terminal_partida: dep.terminal ?? null, portao_partida: dep.gate ?? null,
    terminal_chegada: arr.terminal ?? null, portao_chegada: arr.gate ?? null, esteira: arr.baggageBelt ?? null,
    atraso_partida_min: diffMin(pReal ?? pRev, pPrev), atraso_chegada_min: diffMin(cReal ?? cRev, cPrev),
    payload_json: f,
  };
  const { data: salvo, error } = await db.from("flight_status").insert(linha).select("*").single();
  if (error) { console.error("flight_status insert", error); return { status: ultimo, aviso: "Não consegui atualizar agora.", numero }; }
  return { status: salvo as StatusVoo, numero };
}
