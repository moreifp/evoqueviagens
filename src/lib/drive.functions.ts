import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { tokenDrive } from "./google-auth.server";

const GW = "https://www.googleapis.com";

async function headers() {
  return { Authorization: `Bearer ${await tokenDrive()}` };
}

async function checar(r: Response, oque: string) {
  if (!r.ok) {
    const t = await r.text();
    console.error(`Drive ${oque} [${r.status}]: ${t}`);
    throw new Error(`Google Drive recusou (${r.status}).`);
  }
  return r.json();
}

type Ctx = { supabase: any; userId: string };

/** Confere que quem pede é o organizador e devolve o nome da pasta da viagem. */
async function nomeDaViagem(context: Ctx, tripId: string) {
  const { data: trip } = await context.supabase.from("trip").select("nome,owner_id").eq("id", tripId).maybeSingle();
  if (!trip || trip.owner_id !== context.userId) throw new Error("Só o organizador envia ao Drive.");
  return ((trip.nome as string) || "Viagem").replace(/[\\/:*?"<>|']/g, "-").trim() || "Viagem";
}

/** Acha (ou cria) a pasta com o nome da viagem no Google Drive. Só o organizador. */
export const pastaDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tripId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const nome = await nomeDaViagem(context, data.tripId);
    const q = `name='${nome}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const achou = await checar(await fetch(`${GW}/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`, { headers: await headers() }), "busca");
    if (achou.files?.[0]?.id) return { id: achou.files[0].id as string, nome };
    const nova = await checar(
      await fetch(`${GW}/drive/v3/files?fields=id`, {
        method: "POST",
        headers: { ...(await headers()), "Content-Type": "application/json" },
        body: JSON.stringify({ name: nome, mimeType: "application/vnd.google-apps.folder" }),
      }),
      "pasta",
    );
    return { id: nova.id as string, nome };
  });

/** Envia uma foto (base64) para a pasta da viagem. Só o organizador, só na pasta dessa viagem. */
export const fotoDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tripId: z.string().uuid(), pastaId: z.string().regex(/^[\w-]{5,200}$/), nome: z.string().min(1).max(200), base64: z.string().min(10).max(40_000_000) }).parse(d))
  .handler(async ({ data, context }) => {
    const nomeViagem = await nomeDaViagem(context, data.tripId);
    const pasta = await checar(await fetch(`${GW}/drive/v3/files/${data.pastaId}?fields=name,mimeType,trashed`, { headers: await headers() }), "pasta");
    if (pasta.mimeType !== "application/vnd.google-apps.folder" || pasta.trashed || pasta.name !== nomeViagem)
      throw new Error("Pasta do Drive não é a desta viagem.");
    const b = "evoque" + crypto.randomUUID();
    const meta = JSON.stringify({ name: data.nome, parents: [data.pastaId] });
    const corpo = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: image/jpeg\r\nContent-Transfer-Encoding: base64\r\n\r\n${data.base64}\r\n--${b}--`;
    await checar(
      await fetch(`${GW}/upload/drive/v3/files?uploadType=multipart&fields=id`, {
        method: "POST",
        headers: { ...(await headers()), "Content-Type": `multipart/related; boundary=${b}` },
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
    const r = await checar(await fetch(`${GW}/drive/v3/about?fields=user`, { headers: await headers() }), "conta");
    return { email: (r.user?.emailAddress as string) ?? "", nome: (r.user?.displayName as string) ?? "" };
  });

