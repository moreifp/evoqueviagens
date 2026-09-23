const CACHE = "evoque-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(["/", "/manifest.webmanifest", "/icon-192.png", "/favicon.png"])),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// A página manda a lista do que já carregou; guardamos tudo para abrir no modo avião.
self.addEventListener("message", (event) => {
  const d = event.data;
  if (!d || d.tipo !== "guardar" || !Array.isArray(d.urls)) return;
  event.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(
        d.urls.map((u) =>
          fetch(u, { credentials: "same-origin" })
            .then((r) => (r.ok || r.type === "opaque" ? c.put(u, r) : null))
            .catch(() => null),
        ),
      ),
    ),
  );
});

function ignorar(url) {
  return (
    url.pathname.startsWith("/~oauth") ||
    url.pathname.startsWith("/_serverFn") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/c/") ||
    url.hostname.endsWith(".supabase.co")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (ignorar(url)) return;

  // Navegação: rede primeiro; sem rede, a mesma página guardada, senão a tela inicial.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(url.pathname, copia));
          }
          return res;
        })
        .catch(async () => {
          const c = await caches.open(CACHE);
          return (await c.match(url.pathname)) || (await c.match("/")) || Response.error();
        }),
    );
    return;
  }

  const fonte = url.hostname.includes("fonts.googleapis.com") || url.hostname.includes("fonts.gstatic.com");
  if (url.origin !== self.location.origin && !fonte) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const rede = fetch(req)
        .then((res) => {
          if (res.ok || res.type === "opaque") {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
          }
          return res;
        })
        .catch(() => cached || Response.error());
      return cached || rede;
    }),
  );
});
