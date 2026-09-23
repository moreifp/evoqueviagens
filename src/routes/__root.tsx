import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AuthGate } from "@/components/AuthGate";
import { AbasApp, AvisoConexao } from "@/components/Chrome";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-3xl text-foreground">Página não encontrada</h1>
        <div className="mt-6">
          <Link
            to="/"
            className="tap inline-flex items-center justify-center rounded-xl bg-primary px-6 text-lg font-bold text-primary-foreground"
          >
            Ir para início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl text-foreground">Esta tela não carregou</h1>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="tap inline-flex items-center justify-center rounded-xl bg-primary px-6 text-lg font-bold text-primary-foreground"
          >
            Tentar de novo
          </button>
          <a
            href="/"
            className="tap inline-flex items-center justify-center rounded-xl border-2 border-border px-6 text-lg font-bold text-foreground"
          >
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { name: "theme-color", content: "#0c1a26" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Evoque" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelado = false;
    (async () => {
      const [{ persistQueryClient }, { createAsyncStoragePersister }, idb] = await Promise.all([
        import("@tanstack/react-query-persist-client"),
        import("@tanstack/query-async-storage-persister"),
        import("idb-keyval"),
      ]);
      if (cancelado) return;
      persistQueryClient({
        queryClient: queryClient as unknown as Parameters<typeof persistQueryClient>[0]["queryClient"],
        persister: createAsyncStoragePersister({
          storage: { getItem: (k) => idb.get(k), setItem: (k, v) => idb.set(k, v), removeItem: (k) => idb.del(k) },
          key: "evoque-cache",
        }),
        maxAge: 1000 * 60 * 60 * 24 * 30,
        buster: "evoque-v2",
      });
    })();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then((reg) => {
          // Guarda no aparelho tudo que esta tela já carregou (scripts, estilos, fontes).
          const urls = performance
            .getEntriesByType("resource")
            .map((e) => e.name)
            .filter((u) => u.startsWith(location.origin) || u.includes("fonts.g"));
          reg.active?.postMessage({ tipo: "guardar", urls: [...urls, location.href] });
        })
        .catch(() => {});
    }
    return () => {
      cancelado = true;
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Conteudo />
      <AvisoConexao />
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  );
}

function Conteudo() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path.startsWith("/c/")) return <Outlet />;
  const mostraAbas = !path.startsWith("/trip/");
  return (
    <AuthGate>
      <Outlet />
      {mostraAbas && <AbasApp />}
    </AuthGate>
  );
}
