/** Único lugar que registra o service worker. Nunca em desenvolvimento, prévia ou iframe. */
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

export async function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (contextoRecusado()) {
    const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
    await Promise.all(regs.filter((r) => r.active?.scriptURL.endsWith("/sw.js") || r.installing || r.waiting).map((r) => r.unregister()));
    return;
  }
  try {
    await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
  } catch {
    /* segue sem modo offline */
  }
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* navegador não permite */
  }
}
