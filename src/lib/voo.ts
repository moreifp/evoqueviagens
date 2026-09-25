/** Utilidades do status de voo — usadas no aparelho e no servidor. */

/** Limite mensal do plano AeroDataBox (troque aqui ao mudar de plano). */
export const LIMITE_MENSAL_UNIDADES = 400;
export const TETO_JOB = Math.floor(LIMITE_MENSAL_UNIDADES * 0.8);
export const UNIDADES_POR_CHAMADA = 2;
export const CACHE_MIN = 10;

const IATA_POR_NOME: Record<string, string> = {
  latam: "LA", "latam airlines": "LA", tam: "JJ", tap: "TP", "tap air portugal": "TP", "tap portugal": "TP",
  azul: "AD", gol: "G3", american: "AA", "american airlines": "AA", "air france": "AF", klm: "KL",
  iberia: "IB", united: "UA", "united airlines": "UA", delta: "DL", "delta air lines": "DL", emirates: "EK",
  lufthansa: "LH", british: "BA", "british airways": "BA", copa: "CM", "copa airlines": "CM", avianca: "AV",
  "aerolineas argentinas": "AR", "aerolíneas argentinas": "AR", qatar: "QR", "qatar airways": "QR",
  "turkish airlines": "TK", turkish: "TK", swiss: "LX", "ita airways": "AZ", ita: "AZ", alitalia: "AZ",
  "air europa": "UX", "air canada": "AC", jetsmart: "JA", sky: "H2", "sky airline": "H2", ethiopian: "ET",
  "south african": "SA", "royal air maroc": "AT", "aeromexico": "AM", "aeroméxico": "AM", "virgin atlantic": "VS",
  easyjet: "U2", ryanair: "FR", vueling: "VY", "air china": "CA", "singapore airlines": "SQ", "etihad": "EY",
};

export function codigoCompanhia(companhia: string | null | undefined): string | null {
  const c = (companhia ?? "").trim();
  if (!c) return null;
  if (/^[A-Z0-9]{2}$/i.test(c)) return c.toUpperCase();
  const k = c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return IATA_POR_NOME[c.toLowerCase()] ?? IATA_POR_NOME[k] ?? null;
}

/** "TP" + "088" → "TP88". Aceita também número já com a companhia ("TP 088"). */
export function numeroVoo(companhia: string | null | undefined, numero: string | null | undefined): string | null {
  const bruto = (numero ?? "").toUpperCase().replace(/[\s-]+/g, "");
  const embutido = /^([A-Z]{2}|[A-Z]\d|\d[A-Z])0*(\d{1,4}[A-Z]?)$/.exec(bruto);
  if (embutido && !/^\d/.test(bruto.slice(0, 2).replace(/^\d[A-Z]$/, "X"))) return `${embutido[1]}${embutido[2]}`;
  const so = /^0*(\d{1,4}[A-Z]?)$/.exec(bruto);
  const cod = codigoCompanhia(companhia);
  if (!cod || !so) return embutido ? `${embutido[1]}${embutido[2]}` : null;
  return `${cod}${so[1]}`;
}

/** Data local (YYYY-MM-DD) da partida no fuso da origem. */
export function dataLocalPartida(partidaUtc: string, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(partidaUtc));
}

/** Status só é consultado a partir de N dias antes da partida (antes disso a API devolve o voo de outro dia). */
export const STATUS_DIAS_ANTES = 3;

/** Data (YYYY-MM-DD, local da origem) a partir da qual o status fica disponível; null = já disponível. */
export function statusDisponivelEm(partidaUtc: string, tz: string, agora = Date.now()): string | null {
  const inicio = Date.parse(partidaUtc) - STATUS_DIAS_ANTES * 86_400_000;
  return agora >= inicio ? null : dataLocalPartida(new Date(inicio).toISOString(), tz);
}

export const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function mesAtual(d = new Date()) {
  return d.toISOString().slice(0, 7);
}

export type StatusVoo = {
  id: string; ticket_id: string; consultado_em: string; status: string | null;
  partida_prevista_utc: string | null; partida_revista_utc: string | null; partida_real_utc: string | null;
  chegada_prevista_utc: string | null; chegada_revista_utc: string | null; chegada_real_utc: string | null;
  terminal_partida: string | null; portao_partida: string | null; terminal_chegada: string | null; portao_chegada: string | null;
  esteira: string | null; atraso_partida_min: number | null; atraso_chegada_min: number | null; origem: string;
};

export function cancelado(s: Pick<StatusVoo, "status"> | null | undefined) {
  return /cancel/i.test(s?.status ?? "");
}

/** Chip principal: cancelado > atrasado > portão > no horário. */
export function chipDoStatus(s: StatusVoo): { texto: string; tom: "ok" | "warn" | "danger" | "muted" } {
  if (cancelado(s)) return { texto: "Cancelado", tom: "danger" };
  const atraso = s.atraso_partida_min ?? 0;
  if (atraso >= 15) return { texto: `Atrasado ${formatarAtraso(atraso)}`, tom: "warn" };
  if (s.portao_partida && !/arrived|landed/i.test(s.status ?? "")) return { texto: `Portão ${s.portao_partida}`, tom: "ok" };
  if (/arrived|landed/i.test(s.status ?? "")) return { texto: "Pousou", tom: "ok" };
  if (/unknown/i.test(s.status ?? "") || !s.status) return { texto: "Sem informação", tom: "muted" };
  return { texto: "No horário", tom: "ok" };
}

export function formatarAtraso(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h}h${m ? String(m).padStart(2, "0") : ""}` : `${m} min`;
}

/** Horários efetivos (revisto/real quando houver) para o auditor. */
export function horariosEfetivos(s: StatusVoo | undefined) {
  if (!s || cancelado(s)) return null;
  return {
    partida: s.partida_real_utc ?? s.partida_revista_utc ?? null,
    chegada: s.chegada_real_utc ?? s.chegada_revista_utc ?? null,
  };
}

/**
 * Decide se é a vez de consultar um voo:
 * 24h antes · 6h antes · a cada 30 min nas 3h antes · a cada 60 min em voo · uma vez após o pouso.
 */
export function ehAVez(partidaMs: number, chegadaMs: number, ultimaMs: number | null, agora = Date.now()) {
  const desde = (ms: number) => ultimaMs === null || ultimaMs < ms;
  const H = 3_600_000;
  if (agora >= chegadaMs) return desde(chegadaMs); // uma vez após o pouso
  if (agora >= partidaMs) return ultimaMs === null || agora - ultimaMs >= 60 * 60_000 - 60_000;
  if (agora >= partidaMs - 3 * H) return ultimaMs === null || agora - ultimaMs >= 30 * 60_000 - 60_000;
  if (agora >= partidaMs - 6 * H) return desde(partidaMs - 6 * H);
  if (agora >= partidaMs - 24 * H) return desde(partidaMs - 24 * H);
  return false;
}
