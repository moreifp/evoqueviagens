import { supabase } from "@/integrations/supabase/client";

/**
 * Cópias de anexos guardadas no aparelho (Cache Storage "evoque-anexos").
 * Só gravamos arquivos das viagens baixadas e documentos da própria conta e dependentes.
 * Documentos compartilhados por outras pessoas nunca são gravados.
 */
const CACHE = "evoque-anexos";
const chave = (ref: string) => `/__anexo/${encodeURIComponent(ref)}`;
const ehUrl = (ref: string) => /^https?:\/\//i.test(ref);

async function abrirCache() {
  if (typeof caches === "undefined") return null;
  try {
    return await caches.open(CACHE);
  } catch {
    return null;
  }
}

async function urlRemota(ref: string, segundos = 60): Promise<string | null> {
  if (ehUrl(ref)) return ref;
  const { data } = await supabase.storage.from("documentos").createSignedUrl(ref, segundos);
  return data?.signedUrl ?? null;
}

/** Baixa e guarda um arquivo no aparelho. Falha em silêncio. */
export async function guardarAnexo(ref: string | null | undefined) {
  if (!ref || !navigator.onLine) return;
  const cache = await abrirCache();
  if (!cache || (await cache.match(chave(ref)))) return;
  try {
    const url = await urlRemota(ref, 120);
    if (!url) return;
    const r = await fetch(url);
    if (!r.ok) return;
    const blob = await r.blob();
    await cache.put(chave(ref), new Response(blob, { headers: { "Content-Type": blob.type || r.headers.get("Content-Type") || "application/octet-stream" } }));
  } catch {
    /* sem CORS ou sem rede: fica só online */
  }
}

/** Apaga cópias que não pertencem mais ao conjunto baixado. */
export async function limparAnexos(manter: Set<string>) {
  const cache = await abrirCache();
  if (!cache) return;
  for (const req of await cache.keys()) {
    const ref = decodeURIComponent(new URL(req.url).pathname.replace("/__anexo/", ""));
    if (!manter.has(ref)) await cache.delete(req);
  }
}

/** URL para exibir: a cópia do aparelho quando existe; senão, link assinado (só com internet). */
export async function urlDoAnexo(ref: string | null | undefined): Promise<string | null> {
  if (!ref) return null;
  const cache = await abrirCache();
  const guardado = cache ? await cache.match(chave(ref)) : undefined;
  if (guardado) return URL.createObjectURL(await guardado.blob());
  if (!navigator.onLine) return null;
  try {
    return await urlRemota(ref);
  } catch {
    return null;
  }
}

/** Abre o anexo em nova aba. A aba é aberta já no toque, para o iPhone não bloquear. */
export async function abrirAnexo(ref: string): Promise<boolean> {
  const janela = window.open("", "_blank");
  const url = await urlDoAnexo(ref);
  if (!url) {
    janela?.close();
    return false;
  }
  if (janela) janela.location.href = url;
  else window.location.href = url;
  return true;
}
