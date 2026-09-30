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

if (!HOST_SEM_APP) self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const lista = [OFFLINE, ...(self.__EVOQUE_PRECACHE || [])];
      // Caches de versões anteriores: arquivo com o mesmo nome com hash (/assets/x-AbC123.js) tem o mesmo conteúdo,
      // então é copiado de lá em vez de baixar de novo. Arquivos sem hash (ícones, offline.html) sempre vão à rede.
      const nomes = (await caches.keys()).filter((n) => (n.startsWith("evoque-app-") && n !== CACHE) || n === RUNTIME);
      const velhos = await Promise.all(nomes.map((n) => caches.open(n)));
      const comHash = (u) => /^\/assets\/.+-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/.test(u);
      let copiados = 0, baixados = 0;
      // Um arquivo que falhar não impede os outros.
      await Promise.allSettled(lista.map(async (u) => {
        if (comHash(u)) {
          for (const c of velhos) {
            const g = await c.match(u, { ignoreVary: true, ignoreSearch: true });
            if (g && g.ok) { await cache.put(u, g); copiados++; return; }
          }
        }
        const r = await fetch(new Request(u, { cache: "reload" }));
        if (confiavel(r)) { await cache.put(u, await limpar(r)); baixados++; }
      }));
      console.info("[sw] instalação", VERSAO, "· copiados do cache:", copiados, "· baixados:", baixados);
      try {
        const r = await fetch("/", { cache: "reload", credentials: "same-origin" });
        if (confiavel(r)) await cache.put(SHELL, await limpar(r));
      } catch (e) {}
      await self.skipWaiting();
    })(),
  );
});

if (!HOST_SEM_APP) self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(nomes.filter((n) => n.startsWith("evoque-") && n !== CACHE && n !== ANEXOS && n !== LOGOS).map((n) => caches.delete(n)));
      await self.clients.claim();
      // Uma versão nova pode assumir enquanto o app instalado ainda exibe a
      // casca anterior. Reabre cada tela controlada uma vez para ela carregar
      // os arquivos que acabaram de ser instalados.
      const abas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      await Promise.allSettled(abas.map((c) => c.navigate(c.url)));
    })(),
  );
});

// Resposta boa para guardar: 200, mesmo host, sem ter sido desviada (portal de Wi-Fi de avião/aeroporto).
function confiavel(r) {
  if (!r || !r.ok || r.type === "opaqueredirect") return false;
  try {
    if (r.redirected && new URL(r.url).host !== self.location.host) return false;
    if (r.url && new URL(r.url).host !== self.location.host) return false;
  } catch (e) { return false; }
  return true;
}

async function guardarRuntime(req, r) {
  const c = await caches.open(RUNTIME);
  await c.put(req, r);
  const k = await c.keys();
  // Limite de ~200 itens: apaga os mais antigos.
  for (let i = 0; i < k.length - 200; i++) await c.delete(k[i]);
}

async function daRede(request, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(request, { signal: ctl.signal });
    if (!confiavel(r)) return null;
    const limpo = await limpar(r);
    const a = limpo.clone(), b = limpo.clone();
    guardarRuntime(request, a).catch(() => {});
    if (new URL(request.url).pathname === "/") caches.open(CACHE).then((c) => c.put(SHELL, b)).catch(() => {});
    return limpo;
  } catch (e) {
    return null;
  } finally { clearTimeout(t); }
}

// Navegação: com internet, busca a página nova (até 2,5 s) para o app instalado
// sempre abrir na versão publicada; sem internet ou lento, usa a casca guardada.
async function navegar(request) {
  const r = await daRede(request, 2500);
  if (r) return r;
  return (await caches.match(SHELL)) || (await caches.match(request)) || (await caches.match(OFFLINE)) || Response.error();
}

async function arquivo(request) {
  const guardado = await caches.match(request, { ignoreVary: true });
  if (guardado) return guardado;
  const r = await fetch(request);
  if (confiavel(r) && r.type === "basic") {
    const copia = r.clone();
    guardarRuntime(request, copia).catch(() => {});
  }
  return r;
}

// Avisos push (Firebase Cloud Messaging): o recebimento em segundo plano mora aqui,
// no mesmo worker do app — sem segundo service worker.
if (!HOST_SEM_APP) self.addEventListener("push", (event) => {
  let dados = {};
  try { dados = event.data ? event.data.json() : {}; } catch (e) { dados = {}; }
  const notif = dados.notification || {};
  const titulo = notif.title || "Evoque Viagens";
  const url = typeof dados.data?.url === "string" && dados.data.url.startsWith("/") ? dados.data.url : "/";
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: notif.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url },
    }),
  );
});

if (!HOST_SEM_APP) self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil((async () => {
    const abas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const aberta = abas.find((c) => c.url.startsWith(self.location.origin));
    if (aberta) {
      await aberta.focus();
      aberta.navigate(self.location.origin + url).catch(() => {});
    } else {
      await self.clients.openWindow(url);
    }
  })());
});

if (!HOST_SEM_APP) self.addEventListener("fetch", (event) => {
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
