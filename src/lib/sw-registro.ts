/** Único lugar que registra o service worker. Nunca em desenvolvimento, prévia ou iframe. */
declare const __EVOQUE_BUILD__: string;
function contextoRecusado() {
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = location.hostname;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
  if (/(^|\.)lovableproject(-dev)?\.com$/.test(h) || /(^|\.)beta\.lovable\.dev$/.test(h)) return true;
  if (new URLSearchParams(location.search).get("sw") === "off") return true;
  return false;
}

/** Versão publicada agora no servidor (gerada a cada build em /sw-precache.js). */
async function versaoPublicada(): Promise<string | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(`/sw-precache.js?t=${Date.now()}`, { cache: "no-store", signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const m = /__EVOQUE_VERSAO="([^"]+)"/.exec(await r.text());
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}



export async function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (contextoRecusado()) {
    const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
    await Promise.all(regs.filter((r) => r.active?.scriptURL.includes("/sw.js") || r.installing || r.waiting).map((r) => r.unregister()));
    return;
  }
  try {
    let trocouControle = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (trocouControle) return;
      trocouControle = true;
      window.location.reload();
    });

    // O endereço do worker leva a versão PUBLICADA (lida direto do servidor), não a
    // da tela que está aberta: mesmo quando o aparelho abriu a casca antiga, ele
    // instala a versão nova, apaga o cache velho e recarrega.
    const build = typeof __EVOQUE_BUILD__ !== "undefined" ? __EVOQUE_BUILD__ : "";
    const publicada = (await versaoPublicada()) ?? build;
    let registro = await navigator.serviceWorker.register(
      publicada ? `/sw.js?v=${encodeURIComponent(publicada)}` : "/sw.js",
      { updateViaCache: "none" },
    );
    await registro.update().catch(() => {});

    let checando = false;
    const verificar = async () => {
      if (checando || !navigator.onLine) return;
      checando = true;
      try {
        const v = await versaoPublicada();
        const marca = v ? `v=${encodeURIComponent(v)}` : "";
        const jaTem =
          !marca ||
          [registro.active, registro.waiting, registro.installing].some((w) => w?.scriptURL.includes(marca));
        if (jaTem) await registro.update().catch(() => {});
        else registro = await navigator.serviceWorker.register(`/sw.js?${marca}`, { updateViaCache: "none" });
      } catch {
        /* tenta de novo na próxima volta */
      } finally {
        checando = false;
      }
    };
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void verificar();
    };
    window.addEventListener("online", () => void verificar());
    document.addEventListener("visibilitychange", aoVoltar);
  } catch {
    /* segue sem modo offline */
  }
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* navegador não permite */
  }
}
