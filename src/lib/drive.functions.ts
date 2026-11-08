import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { tokenDrive } from "./google-auth.server";
import { enviarArquivo, extensao, nomeSeguro, pastaViagem, subpasta, SUBPASTA_POR_ITEM, type Subpasta } from "./drive.server";

const GW = "https://www.googleapis.com";

type Ctx = { supabase: any; userId: string };

/** Confere que quem pede é o organizador e devolve o nome da viagem. */
async function viagemDoOrganizador(context: Ctx, tripId: string) {
  const { data: trip } = await context.supabase.from("trip").select("id,nome,owner_id").eq("id", tripId).maybeSingle();
  if (!trip || trip.owner_id !== context.userId) throw new Error("Só o organizador envia ao Drive.");
  return trip as { id: string; nome: string };
}

const id8 = (id: string) => id.replace(/-/g, "").slice(0, 8);

/**
 * Envia o ORIGINAL de uma foto (base64, vindo do aparelho do organizador) para
 * Viagens/<viagem>/Fotos. Chamado pela aba Fotos assim que há internet.
 */
export const fotoDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        tripId: z.string().uuid(),
        nome: z.string().min(1).max(200),
        base64: z.string().min(10).max(40_000_000),
        photoId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const trip = await viagemDoOrganizador(context, data.tripId);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const chave = data.photoId ? `original:${data.photoId}` : `original:${data.nome}`;
    const { data: ja } = await db.from("drive_backup").select("id").eq("bucket", "fotos-viagem").eq("storage_path", chave).eq("origem", "original").maybeSingle();
    if (ja) return { ok: true, repetida: true };
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const pasta = await pastaViagem(trip.nome);
    const fotos = await subpasta(pasta.id, "Fotos");
    const driveId = await enviarArquivo({ pastaId: fotos, nome: nomeSeguro(data.nome, "foto.jpg"), mime: "image/jpeg", bytes });
    await db.from("drive_backup").upsert(
      { trip_id: trip.id, bucket: "fotos-viagem", storage_path: chave, origem: "original", pasta: `${pasta.nome}/Fotos`, drive_file_id: driveId },
      { onConflict: "bucket,storage_path,origem" },
    );
    return { ok: true, pasta: pasta.nome };
  });

type Pendente = {
  bucket: "documentos" | "fotos-viagem";
  path: string;
  origem: "arquivo" | "mini";
  sub: Subpasta;
  nome: string;
  mime: string;
  descricao?: string;
};

const LIMITE_POR_CHAMADA = 12;
const TEMPO_MAX_MS = 20_000;
const CARENCIA_MINI_MS = 24 * 60 * 60_000;

function dataBR(iso: string | null | undefined) {
  const s = (iso ?? "").slice(0, 10);
  return s ? s : "";
}

/**
 * Confere tudo que a viagem tem no storage (anexos de passagens, hospedagem e
 * reservas, recibos de despesas e fotos) e manda ao Drive o que ainda não foi,
 * em Viagens/<viagem>/<subpasta>. Só o organizador. Roda em lotes: devolve
 * quantos ainda faltam, e quem chama repete até zerar.
 */
export const sincronizarDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tripId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const inicio = Date.now();
    const trip = await viagemDoOrganizador(context, data.tripId);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    const [{ data: feitos }, { data: anexos }, { data: despesas }, { data: fotos }] = await Promise.all([
      db.from("drive_backup").select("bucket,storage_path,origem").eq("trip_id", trip.id),
      db.from("item_attachment").select("id,item_tipo,nome,content_type,storage_path").is("deleted_at", null).like("storage_path", `trip/${trip.id}/%`),
      db.from("expense").select("id,data,descricao,recibo_path").eq("trip_id", trip.id).is("deleted_at", null).like("recibo_path", "trip/%"),
      db.from("trip_photo").select("id,storage_path,tirada_em,created_at").eq("trip_id", trip.id).is("deleted_at", null),
    ]);
    const ja = new Set((feitos ?? []).map((f: { bucket: string; storage_path: string; origem: string }) => `${f.bucket}|${f.storage_path}|${f.origem}`));
    const originais = new Set(
      (feitos ?? [])
        .filter((f: { origem: string }) => f.origem === "original")
        .map((f: { storage_path: string }) => f.storage_path.replace(/^original:/, "")),
    );

    const pendentes: Pendente[] = [];
    for (const a of anexos ?? []) {
      if (ja.has(`documentos|${a.storage_path}|arquivo`)) continue;
      const sub = SUBPASTA_POR_ITEM[a.item_tipo];
      if (!sub) continue;
      const limpo = (a.nome ?? "anexo").replace(/^🔒[^·]*·\s*/u, "").trim();
      const ext = extensao(limpo, a.content_type);
      const base = nomeSeguro(limpo.replace(/\.[a-z0-9]{2,5}$/i, ""), "anexo");
      pendentes.push({ bucket: "documentos", path: a.storage_path, origem: "arquivo", sub, nome: `${base} [${id8(a.id)}].${ext}`, mime: a.content_type || "application/octet-stream" });
    }
    for (const d of despesas ?? []) {
      if (!d.recibo_path || ja.has(`documentos|${d.recibo_path}|arquivo`)) continue;
      const ext = extensao(d.recibo_path, null);
      const mime = ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : ext === "heic" ? "image/heic" : "image/jpeg";
      const base = nomeSeguro(`Recibo ${dataBR(d.data)} ${d.descricao ?? ""}`, "Recibo");
      pendentes.push({ bucket: "documentos", path: d.recibo_path, origem: "arquivo", sub: "Despesas", nome: `${base} [${id8(d.id)}].${ext}`, mime, descricao: d.descricao ?? undefined });
    }
    for (const f of fotos ?? []) {
      // A cópia pequena só vai se o original não chegou (ex.: foto de um participante),
      // depois de um dia de carência para o aparelho do organizador mandar o original.
      if (originais.has(f.id) || ja.has(`fotos-viagem|${f.storage_path}|mini`)) continue;
      if (Date.now() - Date.parse(f.created_at) < CARENCIA_MINI_MS) continue;
      const quando = (f.tirada_em ?? f.created_at).slice(0, 19).replace("T", " ").replace(/:/g, "-");
      pendentes.push({ bucket: "fotos-viagem", path: f.storage_path, origem: "mini", sub: "Fotos", nome: `${nomeSeguro(trip.nome)} ${quando} [${id8(f.id)}] (reduzida).jpg`, mime: "image/jpeg" });
    }

    if (!pendentes.length) return { enviados: 0, restantes: 0, pasta: null as string | null };

    const pasta = await pastaViagem(trip.nome);
    const subIds = new Map<Subpasta, string>();
    let enviados = 0;
    const erros: string[] = [];
    for (const p of pendentes.slice(0, LIMITE_POR_CHAMADA)) {
      if (Date.now() - inicio > TEMPO_MAX_MS) break;
      try {
        const { data: blob, error } = await db.storage.from(p.bucket).download(p.path);
        if (error || !blob) throw new Error(error?.message ?? "arquivo não encontrado no storage");
        const bytes = await blob.arrayBuffer();
        if (bytes.byteLength === 0) throw new Error("arquivo vazio");
        let subId = subIds.get(p.sub);
        if (!subId) {
          subId = await subpasta(pasta.id, p.sub);
          subIds.set(p.sub, subId);
        }
        const driveId = await enviarArquivo({ pastaId: subId, nome: p.nome, mime: p.mime, bytes, descricao: p.descricao });
        await db.from("drive_backup").upsert(
          { trip_id: trip.id, bucket: p.bucket, storage_path: p.path, origem: p.origem, pasta: `${pasta.nome}/${p.sub}`, drive_file_id: driveId },
          { onConflict: "bucket,storage_path,origem" },
        );
        enviados++;
      } catch (e) {
        console.error("drive sincronizar", p.path, (e as Error).message);
        erros.push(p.nome);
      }
    }
    return { enviados, restantes: pendentes.length - enviados - erros.length, pasta: pasta.nome, erros: erros.length };
  });

/** Conta Google ligada ao Drive deste projeto. */
export const contaDrive = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const r = await fetch(`${GW}/drive/v3/about?fields=user`, { headers: { Authorization: `Bearer ${await tokenDrive()}` } });
    if (!r.ok) throw new Error(`Google Drive recusou (${r.status}).`);
    const j = (await r.json()) as { user?: { emailAddress?: string; displayName?: string } };
    return { email: j.user?.emailAddress ?? "", nome: j.user?.displayName ?? "" };
  });
