export const MOEDAS = ["BRL", "USD", "EUR", "GBP", "ARS", "CLP", "JPY", "CHF"] as const;

export function fmtMoney(valor: number, moeda: string) {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: moeda,
      maximumFractionDigits: 2,
    }).format(valor);
  } catch {
    return `${moeda} ${valor.toFixed(2)}`;
  }
}

export function fmtMoneyShort(valor: number, moeda: string) {
  return fmtMoney(valor, moeda).replace(/\u00a0/g, " ");
}

/** Hora HH:mm no fuso do evento. */
export function horaNoFuso(iso: string, tz: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  }
}

export function dataNoFuso(iso: string, tz: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      timeZone: tz,
    }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(
      new Date(iso),
    );
  }
}

export function diaSemana(iso: string, tz?: string) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: tz }).format(
    new Date(iso),
  );
}

/** Chave AAAA-MM-DD do instante, no fuso informado. */
export function chaveDia(iso: string, tz?: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "01";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function fusoLocal() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "America/Sao_Paulo";
  }
}

export function nomeFusoCurto(tz: string) {
  return tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
}

export function dataBRCurta(data: string) {
  const [a, m, d] = data.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, d ?? 1)),
  );
}

export function mesAno(data: string) {
  const [a, m] = data.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, 1)),
  );
}

export function diasAte(data: string) {
  const hoje = new Date();
  const [a, m, d] = data.split("-").map(Number);
  const alvo = Date.UTC(a ?? 1970, (m ?? 1) - 1, d ?? 1);
  const base = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvo - base) / 86400000);
}

export function somaDias(dia: string, n: number) {
  const [a, m, d] = dia.split("-").map(Number);
  const t = new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, (d ?? 1) + n));
  return t.toISOString().slice(0, 10);
}
