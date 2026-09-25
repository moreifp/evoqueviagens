/** "2026-05-01T22:35" no fuso tz → ISO UTC. */
export function localParaUtc(valor: string, tz: string) {
  const base = new Date(`${valor}:00Z`);
  const offset = offsetMs(base, tz);
  return new Date(base.getTime() - offset).toISOString();
}

/** ISO UTC → "2026-05-01T22:35" no fuso tz (para preencher datetime-local). */
export function utcParaLocal(iso: string | null | undefined, tz: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() + offsetMs(d, tz)).toISOString().slice(0, 16);
}

function offsetMs(d: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  const comoTz = Date.UTC(Number(p["year"]), Number(p["month"]) - 1, Number(p["day"]), Number(p["hour"]) % 24, Number(p["minute"]), Number(p["second"]));
  return comoTz - Math.floor(d.getTime() / 1000) * 1000;
}

export function todosFusos(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
  } catch {
    return ["America/Sao_Paulo", "Europe/Lisbon", "America/New_York", "UTC"];
  }
}
