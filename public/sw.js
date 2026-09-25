// Evoque Viagens — service worker escrito à mão.
// A lista de arquivos do build (self.__EVOQUE_PRECACHE) e a versão (self.__EVOQUE_VERSAO)
// são geradas a cada build em /sw-precache.js.
// Nos domínios da landing (o app mudou para app.evoque.global) este worker só se desfaz:
// apaga os caches do app, sai do ar e recarrega as abas abertas.
const HOST_SEM_APP = ["evoque.global", "www.evoque.global", "evoqueviagens.lovable.app"].includes(self.location.hostname);
if (HOST_SEM_APP) {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
      const nomes = await caches.keys();
      await Promise.all(nomes.filter((n) => n.startsWith("evoque-")).map((n) => caches.delete(n)));
      await self.registration.unregister();
      const abas = await self.clients.matchAll({ type: "window" });
      abas.forEach((c) => c.navigate(c.url).catch(() => {}));
    })());
  });
}

try {
  if (HOST_SEM_APP) throw 0;
  importScripts("/sw-precache.js");
} catch (e) {
  self.__EVOQUE_PRECACHE = [];
  self.__EVOQUE_VERSAO = "dev";
}

const VERSAO = self.__EVOQUE_VERSAO || "dev";
const CACHE = "evoque-app-" + VERSAO;
const RUNTIME = "evoque-runtime";
const ANEXOS = "evoque-anexos"; // cópias de anexos gravadas pelo app; nunca apagar aqui
const LOGOS = "evoque-logos";
const SHELL = "/__shell";
const OFFLINE = "/offline.html";

// Respostas que vieram de redirecionamento não podem responder a uma navegação: recria sem a marca.
async function limpar(r) {
  if (!r.redirected) return r;
  return new Response(await r.blob(), { status: r.status, statusText: r.statusText, headers: r.headers });
}

function ignorar(url) {
  return url.pathname.startsWith("/~oauth") || url.pathname.startsWith("/api/") || url.pathname.startsWith("/_serverFn") || url.pathname === "/sw.js" || url.pathname === "/sw-precache.js";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const lista = [OFFLINE, ...(self.__EVOQUE_PRECACHE || [])];
      // Um arquivo que falhar não impede os outros.
      await Promise.allSettled(lista.map(async (u) => {
        const r = await fetch(new Request(u, { cache: "reload" }));
        if (r.ok) await cache.put(u, await limpar(r));
      }));
      try {
        const r = await fetch("/", { cache: "reload", credentials: "same-origin" });
        if (r.ok) await cache.put(SHELL, await limpar(r));
      } catch (e) {}
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(nomes.filter((n) => n.startsWith("evoque-") && n !== CACHE && n !== RUNTIME && n !== ANEXOS && n !== LOGOS).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

async function navegar(request) {
  try {
    const r = await fetch(request);
    if (r.ok) {
      const copia = r.clone();
      caches.open(RUNTIME).then((c) => c.put(request, copia));
      if (new URL(request.url).pathname === "/") {
        const s = r.clone();
        caches.open(CACHE).then((c) => c.put(SHELL, s));
      }
    }
    return r;
  } catch (e) {
    // Sem internet: qualquer tela abre o app guardado, que desenha com os dados do aparelho.
    return (await caches.match(SHELL)) || (await caches.match(request)) || (await caches.match(OFFLINE)) || Response.error();
  }
}

async function arquivo(request) {
  const guardado = await caches.match(request, { ignoreVary: true });
  if (guardado) return guardado;
  const r = await fetch(request);
  if (r.ok && r.type === "basic") {
    const copia = r.clone();
    caches.open(RUNTIME).then((c) => c.put(request, copia));
  }
  return r;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Logos (Logo.dev): guardados no cache de anexos para abrir sem internet.
  if (url.hostname === "img.logo.dev") {
    event.respondWith((async () => {
      const g = await caches.match(req, { ignoreVary: true });
      if (g) return g;
      const r = await fetch(req);
      if (r.ok || r.type === "opaque") { const c = r.clone(); caches.open(LOGOS).then((x) => x.put(req, c)); }
      return r;
    })());
    return;
  }
  if (url.origin !== self.location.origin || ignorar(url)) return;
  if (req.mode === "navigate") {
    event.respondWith(navegar(req));
    return;
  }
  event.respondWith(arquivo(req));
});
