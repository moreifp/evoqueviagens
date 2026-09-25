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
import { useEffect, useState, type ReactNode } from "react";
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
  const [atualizando, setAtualizando] = useState(false);
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    // Registra a pilha completa no servidor para diagnóstico.
    void import("@/lib/cadastro.functions")
      .then(({ relatarErro }) =>
        relatarErro({
          data: {
            onde: `tela:${location.pathname.slice(0, 50)}`,
            msg: `${String(error?.message ?? error)} | ${String(error?.stack ?? "").slice(0, 850)}`.slice(0, 1000),
            ua: navigator.userAgent.slice(0, 300),
          },
        }),
      )
      .catch(() => {});
    // Erro de tela logo após uma publicação quase sempre é versão velha guardada no
    // aparelho (arquivos do app trocados no servidor). Recarrega uma vez, limpando
    // o service worker, para buscar a versão nova — em vez de só mostrar o erro.
    try {
      const marca = Number(sessionStorage.getItem("evoque-recarregou") ?? 0);
      if (Date.now() - marca > 60_000) {
        sessionStorage.setItem("evoque-recarregou", String(Date.now()));
        setAtualizando(true);
        void (async () => {
          try {
            const regs = await navigator.serviceWorker?.getRegistrations();
            await Promise.all((regs ?? []).map((r) => r.update()));
          } catch {
            /* segue mesmo assim */
          }
          window.location.reload();
        })();
      }
    } catch {
      /* sem storage: só mostra o erro */
    }
  }, [error]);

  if (atualizando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-lg font-bold text-foreground">Atualizando o app…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl text-foreground">Esta tela não carregou</h1>
        <p className="mt-3 break-words text-base text-muted-foreground">{String(error?.message ?? error).slice(0, 200)}</p>
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
          storage: { getItem: (k: string) => idb.get(k), setItem: (k: string, v: string) => idb.set(k, v), removeItem: (k: string) => idb.del(k) },
          key: "evoque-cache-v5",
        }),
        maxAge: 1000 * 60 * 60 * 24 * 30,
        buster: "evoque-eu-v1",
      });
    })();
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").then(async () => {
        await navigator.serviceWorker.ready;
        if (navigator.serviceWorker.controller && navigator.onLine) await fetch(window.location.href, { cache: "no-store" });
      }).catch(() => {});
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
  const mostraAbas = !path.startsWith("/trip/") && !path.startsWith("/pessoas/") && path !== "/nova-viagem";
  return (
    <AuthGate>
      <Outlet />
      {mostraAbas && <AbasApp />}
    </AuthGate>
  );
}
