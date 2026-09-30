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

    // Endereço muda a cada publicação: o iPhone reconhece a versão nova mesmo
    // quando o arquivo do worker em si não mudou.
    const v = typeof __EVOQUE_BUILD__ !== "undefined" ? encodeURIComponent(__EVOQUE_BUILD__) : "";
    const registro = await navigator.serviceWorker.register(v ? `/sw.js?v=${v}` : "/sw.js", { updateViaCache: "none" });
    // Safari/iOS pode manter o app instalado aberto por muitos dias. A busca
    // explícita evita depender apenas da verificação periódica do navegador.
    await registro.update().catch(() => {});

    const verificar = () => void registro.update().catch(() => {});
    const aoVoltar = () => {
      if (document.visibilityState === "visible") verificar();
    };
    window.addEventListener("online", verificar);
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
