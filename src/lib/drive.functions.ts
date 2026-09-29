import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GW = "https://connector-gateway.lovable.dev/google_drive";

function headers() {
  const a = process.env.LOVABLE_API_KEY;
  const b = process.env.GOOGLE_DRIVE_API_KEY;
  if (!a || !b) throw new Error("Google Drive não está ligado.");
  return { Authorization: `Bearer ${a}`, "X-Connection-Api-Key": b };
}

async function checar(r: Response, oque: string) {
  if (!r.ok) {
    const t = await r.text();
    console.error(`Drive ${oque} [${r.status}]: ${t}`);
    throw new Error(`Google Drive recusou (${r.status}).`);
  }
  return r.json();
}

/** Acha (ou cria) a pasta com o nome da viagem no Google Drive. Só o organizador. */
export const pastaDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tripId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: trip } = await context.supabase.from("trip").select("nome,owner_id").eq("id", data.tripId).maybeSingle();
    if (!trip || trip.owner_id !== context.userId) throw new Error("Só o organizador envia ao Drive.");
    const nome = (trip.nome || "Viagem").replace(/[\\/:*?"<>|']/g, "-").trim() || "Viagem";
    const q = `name='${nome}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const achou = await checar(await fetch(`${GW}/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`, { headers: headers() }), "busca");
    if (achou.files?.[0]?.id) return { id: achou.files[0].id as string, nome };
    const nova = await checar(
      await fetch(`${GW}/drive/v3/files?fields=id`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ name: nome, mimeType: "application/vnd.google-apps.folder" }),
      }),
      "pasta",
    );
    return { id: nova.id as string, nome };
  });

/** Envia uma foto (base64) para a pasta. */
export const fotoDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ pastaId: z.string().min(5).max(200), nome: z.string().min(1).max(200), base64: z.string().min(10).max(40_000_000) }).parse(d))
  .handler(async ({ data }) => {
    const b = "evoque" + crypto.randomUUID();
    const meta = JSON.stringify({ name: data.nome, parents: [data.pastaId] });
    const corpo = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: image/jpeg\r\nContent-Transfer-Encoding: base64\r\n\r\n${data.base64}\r\n--${b}--`;
    await checar(
      await fetch(`${GW}/upload/drive/v3/files?uploadType=multipart&fields=id`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": `multipart/related; boundary=${b}` },
        body: corpo,
      }),
      "foto",
    );
    return { ok: true };
  });

/** Conta Google ligada ao Drive deste projeto. */
export const contaDrive = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const r = await checar(await fetch(`${GW}/drive/v3/about?fields=user`, { headers: headers() }), "conta");
    return { email: (r.user?.emailAddress as string) ?? "", nome: (r.user?.displayName as string) ?? "" };
  });

