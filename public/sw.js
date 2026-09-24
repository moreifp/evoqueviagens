// Uma versão antiga guardou arquivos incompatíveis e passou a quebrar links abertos
// pelo navegador padrão. Esta versão remove somente os caches do app e se desativa.
function cacheDoEvoque(nome) {
  return /^evoque-v\d+$/.test(nome) || /(^|-)precache-v\d+-|(^|-)runtime-/.test(nome);
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        const nomes = await caches.keys();
        await Promise.allSettled(nomes.filter(cacheDoEvoque).map((nome) => caches.delete(nome)));
        await self.clients.claim();
        const janelas = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(janelas.map((janela) => janela.navigate(janela.url)));
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);
