import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ITAMARATY, type Emergencia, type PaisEmergencia, type PostoEmergencia } from "./emergencia";

const MAPS = "https://maps.googleapis.com/maps/api";

function chaveMaps(): string {
  const gk = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!gk) throw new Error("Busca indisponível no momento.");
  return gk;
}

type Geo = { cidade: string; iso2: string; pais: string; lat: number; lng: number };

async function geocodificar(cidade: string): Promise<Geo | null> {
  try {
    const r = await fetch(`${MAPS}/geocode/json?address=${encodeURIComponent(cidade)}&language=pt-BR&key=${encodeURIComponent(chaveMaps())}`);
    if (!r.ok) {
      console.error(`geocode [${r.status}]: ${await r.text()}`);
      return null;
    }
    const j = (await r.json()) as {
      status: string;
      results?: { address_components: { short_name: string; long_name: string; types: string[] }[]; geometry: { location: { lat: number; lng: number } } }[];
    };
    const res = j.results?.[0];
    const pais = res?.address_components.find((c) => c.types.includes("country"));
    if (!res || !pais) return null;
    return { cidade, iso2: pais.short_name.toUpperCase(), pais: pais.long_name, lat: res.geometry.location.lat, lng: res.geometry.location.lng };
  } catch (e) {
    console.error("geocode", e);
    return null;
  }
}

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type PostoRow = { id: string; tipo: string; cidade: string; lat: number | null; lng: number | null; telefone: string | null; plantao: string | null; endereco: string | null; site: string | null; email: string | null };

function limpar(p: PostoRow, perto?: string): PostoEmergencia {
  const o: PostoEmergencia = { tipo: p.tipo, cidade: p.cidade };
  if (perto) o.perto_de = perto;
  for (const k of ["telefone", "plantao", "endereco", "site", "email", "lat", "lng"] as const) if (p[k] != null) (o as Record<string, unknown>)[k] = p[k];
  return o;
}

export const buscarEmergencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ trip_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Emergencia> => {
    const sb = context.supabase;
    const { data: trip, error } = await sb.from("trip").select("id, cidades, destino").eq("id", data.trip_id).maybeSingle();
    if (error || !trip) throw new Error("Viagem não encontrada.");
    const cidades = (trip.cidades?.length ? trip.cidades : trip.destino ? [trip.destino] : []).slice(0, 12);
    const geos = (await Promise.all(cidades.map(geocodificar))).filter((g): g is Geo => !!g);
    if (!geos.length) throw new Error("Não achei o país das cidades desta viagem. Confira os nomes das cidades e tente de novo.");

    const isos = [...new Set(geos.map((g) => g.iso2))];
    const [{ data: linhas }, { data: postos }] = await Promise.all([
      sb.from("emergency_country").select("*").in("iso2", isos),
      sb.from("consular_post").select("id, iso2, tipo, cidade, lat, lng, telefone, plantao, endereco, site, email").in("iso2", isos),
    ]);

    let verificado: string | null = null;
    const paises: PaisEmergencia[] = isos.map((iso) => {
      const c = linhas?.find((l) => l.iso2.trim() === iso);
      const nomeGeo = geos.find((g) => g.iso2 === iso)!.pais;
      if (!c) return { iso2: iso, pais: nomeGeo, sem_dados: true, postos: [], outros: [] };
      if (!verificado || c.verificado_em > verificado) verificado = c.verificado_em;
      const doPais = (postos ?? []).filter((p) => p.iso2.trim() === iso) as PostoRow[];
      const escolhidos = new Map<string, string>();
      for (const g of geos.filter((x) => x.iso2 === iso)) {
        const comGeo = doPais.filter((p) => p.lat != null && p.lng != null);
        if (!comGeo.length) continue;
        const perto = comGeo.reduce((a, b) => (km(g, a as { lat: number; lng: number }) <= km(g, b as { lat: number; lng: number }) ? a : b));
        if (!escolhidos.has(perto.id)) escolhidos.set(perto.id, g.cidade);
      }
      return {
        iso2: iso,
        pais: c.pais,
        geral: c.geral,
        policia: c.policia,
        ambulancia: c.ambulancia,
        bombeiros: c.bombeiros,
        obs: c.obs,
        cobertura_sem_posto: doPais.length ? null : c.cobertura_sem_posto,
        fonte_url: c.fonte_url,
        postos: doPais.filter((p) => escolhidos.has(p.id)).map((p) => limpar(p, escolhidos.get(p.id))),
        outros: doPais.filter((p) => !escolhidos.has(p.id)).map((p) => limpar(p)),
      };
    });

    const snap: Emergencia = { conferido_em: new Date().toISOString().slice(0, 10), verificado_em: verificado, paises, itamaraty: ITAMARATY };
    const { data: upd, error: e2 } = await sb.from("trip").update({ emergencia: snap as never }).eq("id", data.trip_id).select("id");
    if (e2 || !upd?.length) throw new Error("Só quem edita a viagem pode buscar os dados de emergência.");
    return snap;
  });
