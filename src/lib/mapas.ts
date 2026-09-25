/** Links diretos para apps de mapa. Nada passa pelo nosso servidor. */
export type Ponto = { nome: string; endereco?: string | null; lat?: number | null; lng?: number | null; place_id?: string | null };

const q = (p: Ponto) => (p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : [p.nome, p.endereco].filter(Boolean).join(", "));

export function linkGoogle(p: Ponto) {
  const u = new URL("https://www.google.com/maps/search/");
  u.searchParams.set("api", "1");
  u.searchParams.set("query", p.lat != null ? q(p) : q(p));
  if (p.place_id) u.searchParams.set("query_place_id", p.place_id);
  return u.toString();
}

export function linkApple(p: Ponto) {
  const u = new URL("https://maps.apple.com/");
  if (p.lat != null && p.lng != null) {
    u.searchParams.set("ll", `${p.lat},${p.lng}`);
    u.searchParams.set("q", p.nome);
  } else u.searchParams.set("q", q(p));
  return u.toString();
}

export function rotaGoogle(destino: Ponto, origem?: { lat: number; lng: number }) {
  const u = new URL("https://www.google.com/maps/dir/");
  u.searchParams.set("api", "1");
  if (origem) u.searchParams.set("origin", `${origem.lat},${origem.lng}`);
  u.searchParams.set("destination", q(destino));
  if (destino.place_id) u.searchParams.set("destination_place_id", destino.place_id);
  return u.toString();
}

export function rotaApple(destino: Ponto, origem?: { lat: number; lng: number }) {
  const u = new URL("https://maps.apple.com/");
  if (origem) u.searchParams.set("saddr", `${origem.lat},${origem.lng}`);
  u.searchParams.set("daddr", q(destino));
  return u.toString();
}

/** Rota do dia com paradas (Google aceita até 9 paradas intermediárias). */
export function rotaDoDia(pontos: Ponto[]) {
  const ps = pontos.filter((p) => p.lat != null || p.endereco || p.nome).slice(0, 11);
  if (!ps.length) return null;
  if (ps.length === 1) return linkGoogle(ps[0]!);
  const u = new URL("https://www.google.com/maps/dir/");
  u.searchParams.set("api", "1");
  u.searchParams.set("origin", q(ps[0]!));
  u.searchParams.set("destination", q(ps[ps.length - 1]!));
  const meio = ps.slice(1, -1);
  if (meio.length) u.searchParams.set("waypoints", meio.map(q).join("|"));
  return u.toString();
}

/** Pede a localização só neste toque. Não guarda nem envia para lugar nenhum além do link do mapa. */
export function localizacaoAgora(): Promise<{ lat: number; lng: number } | undefined> {
  return new Promise((ok) => {
    if (!("geolocation" in navigator)) return ok(undefined);
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: Number(p.coords.latitude.toFixed(5)), lng: Number(p.coords.longitude.toFixed(5)) }),
      () => ok(undefined),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  });
}
