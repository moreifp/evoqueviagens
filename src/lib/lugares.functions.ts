import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

function cabecalhos(extra: Record<string, string> = {}) {
  const lk = process.env.LOVABLE_API_KEY;
  const gk = process.env.GOOGLE_MAPS_API_KEY;
  if (!lk || !gk) throw new Error("Busca de lugares indisponível no momento.");
  return { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": gk, "Content-Type": "application/json", ...extra };
}

async function checar(r: Response, oque: string) {
  if (r.ok) return;
  const corpo = await r.text();
  console.error(`Google Maps ${oque} [${r.status}]: ${corpo}`);
  if (r.status === 403) throw new Error("O Google Maps recusou a busca (403). Verifique a conexão do Google Maps.");
  throw new Error(`Busca de lugar falhou [${r.status}].`);
}

export type Sugestao = { place_id: string; texto: string };

export const autocompletarLugar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        texto: z.string().trim().min(3).max(120),
        sessao: z.string().uuid(),
        perto: z.string().trim().max(80).optional(),
        tipo: z.enum(["lugar", "cidade"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<Sugestao[]> => {
    const cidade = data.tipo === "cidade";
    const input = !cidade && data.perto && !data.texto.toLowerCase().includes(data.perto.toLowerCase()) ? `${data.texto} ${data.perto}` : data.texto;
    const r = await fetch(`${GATEWAY_URL}/places/v1/places:autocomplete`, {
      method: "POST",
      headers: cabecalhos({ "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text" }),
      body: JSON.stringify({ input, sessionToken: data.sessao, languageCode: "pt-BR", ...(cidade ? { includedPrimaryTypes: ["(cities)"] } : {}) }),
    });
    await checar(r, "autocomplete");
    const j = (await r.json()) as { suggestions?: { placePrediction?: { placeId: string; text: { text: string } } }[] };
    return (j.suggestions ?? []).flatMap((s) => (s.placePrediction ? [{ place_id: s.placePrediction.placeId, texto: s.placePrediction.text.text }] : [])).slice(0, 5);
  });

export type Lugar = { place_id: string; nome: string; endereco: string; cidade: string | null; lat: number; lng: number; site: string | null; tz: string | null };

export const detalhesLugar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ place_id: z.string().min(5).max(300).regex(/^[\w-]+$/), sessao: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<Lugar> => {
    const r = await fetch(`${GATEWAY_URL}/places/v1/places/${data.place_id}?sessionToken=${data.sessao}&languageCode=pt-BR`, {
      headers: cabecalhos({ "X-Goog-FieldMask": "id,displayName,formattedAddress,addressComponents,location,websiteUri" }),
    });
    await checar(r, "detalhes");
    const p = (await r.json()) as {
      id: string;
      displayName?: { text: string };
      formattedAddress?: string;
      addressComponents?: { longText: string; types: string[] }[];
      location: { latitude: number; longitude: number };
      websiteUri?: string;
    };
    const comp = (t: string) => p.addressComponents?.find((c) => c.types.includes(t))?.longText ?? null;
    const cidade = comp("locality") ?? comp("postal_town") ?? comp("administrative_area_level_2");
    let tz: string | null = null;
    try {
      const t = await fetch(
        `${GATEWAY_URL}/maps/api/timezone/json?location=${p.location.latitude},${p.location.longitude}&timestamp=${Math.floor(Date.now() / 1000)}`,
        { headers: cabecalhos() },
      );
      await checar(t, "fuso");
      const tj = (await t.json()) as { status: string; timeZoneId?: string };
      if (tj.status === "OK") tz = tj.timeZoneId ?? null;
    } catch (e) {
      console.error("fuso", e);
    }
    return {
      place_id: p.id,
      nome: p.displayName?.text ?? "",
      endereco: p.formattedAddress ?? "",
      cidade,
      lat: p.location.latitude,
      lng: p.location.longitude,
      site: p.websiteUri ?? null,
      tz,
    };
  });
