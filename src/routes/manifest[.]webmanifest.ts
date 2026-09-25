import { createFileRoute } from "@tanstack/react-router";
import { APP_HOST, HOSTS_LANDING, HOSTS_SO_REDIRECIONA, limparHost } from "@/lib/site";

// Manifesto do PWA só onde o app mora; nos domínios da landing não há o que instalar.
export const Route = createFileRoute("/manifest.webmanifest")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url);
        const host = limparHost(request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host);
        if (HOSTS_LANDING.has(host) || HOSTS_SO_REDIRECIONA.has(host)) return new Response("Not found", { status: 404 });
        const base = host === APP_HOST ? `https://${APP_HOST}/` : "/";
        const manifest = {
          id: base,
          name: "Evoque Viagens",
          short_name: "Evoque",
          description: "A viagem inteira em um lugar só: bilhetes, hotel, gastos e conferência de datas.",
          start_url: base,
          scope: base,
          display: "standalone",
          orientation: "portrait",
          background_color: "#0c1a26",
          theme_color: "#0c1a26",
          lang: "pt-BR",
          icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        };
        return new Response(JSON.stringify(manifest), {
          headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "public, max-age=600" },
        });
      },
    },
  },
});
