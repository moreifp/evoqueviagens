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
import { ConviteInstalar } from "@/components/ConviteInstalar";
import { BaixarOffline } from "@/components/BaixarOffline";

import { noHostLanding } from "@/lib/host";
import { ehRotaMarketing } from "@/lib/marketing";
import { HOSTS_LANDING, HOSTS_SO_REDIRECIONA } from "@/lib/site";
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
      if (navigator.onLine && Date.now() - marca > 60_000) {
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
  loader: () => ({ landing: noHostLanding() }),
  head: ({ loaderData }) => ({
    meta: [
      // Telas do app não entram em buscadores; só a landing de evoque.global.
      ...(loaderData?.landing ? [] : [{ name: "robots", content: "noindex, nofollow" }]),
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
      { rel: "preload", href: "/fonts/inter-latin.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "preload", href: "/fonts/outfit-latin.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      ...(loaderData?.landing ? [] : [{ rel: "manifest", href: "/manifest.webmanifest" }]),
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
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
  const { landing } = Route.useLoaderData();
  const path = useRouterState({ select: (s) => s.location.pathname });
  // Marketing usa uma lista fechada: não carrega login, abas, cache nem service worker.
  const marketingPublico = (landing && path === "/") || (path !== "/" && ehRotaMarketing(path));
  if (marketingPublico) return <Outlet />;
  return <RootApp />;
}

function hostComApp() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return !HOSTS_LANDING.has(h) && !HOSTS_SO_REDIRECIONA.has(h);
}

function RootApp() {
  const { queryClient } = Route.useRouteContext();
  const [instalavel, setInstalavel] = useState(false);
  useEffect(() => setInstalavel(hostComApp()), []);
  // Só desenha as telas depois de trazer do aparelho os dados guardados:
  // sem isso, uma tela aberta sem internet ficaria esperando a rede.
  const [restaurado, setRestaurado] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelado = false;
    const liberar = setTimeout(() => setRestaurado(true), 4000);
    (async () => {
      try {
        const [{ persistQueryClient }, { createAsyncStoragePersister }, idb] = await Promise.all([
          import("@tanstack/react-query-persist-client"),
          import("@tanstack/query-async-storage-persister"),
          import("idb-keyval"),
        ]);
        if (cancelado) return;
        const [, restaurando] = persistQueryClient({
          // Casts: bun resolve @tanstack/query-persist-client-core em duas cópias
          // (direta e aninhada em react-query-persist-client); os tipos colidem.
          queryClient: queryClient as unknown as Parameters<typeof persistQueryClient>[0]["queryClient"],
          persister: createAsyncStoragePersister({
            storage: { getItem: (k: string) => idb.get(k), setItem: (k: string, v: string) => idb.set(k, v), removeItem: (k: string) => idb.del(k) },
            key: "evoque-cache-v5",
          }) as unknown as Parameters<typeof persistQueryClient>[0]["persister"],
          maxAge: 1000 * 60 * 60 * 24 * 30,
          buster: "evoque-eu-v1",
        });
        await restaurando.catch(() => {});
      } finally {
        clearTimeout(liberar);
        if (!cancelado) setRestaurado(true);
      }
    })();
    if (hostComApp()) void import("@/lib/sw-registro").then((m) => m.registrarServiceWorker());
    return () => {
      cancelado = true;
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {restaurado ? <Conteudo /> : <div className="min-h-screen bg-background" />}
      <AvisoConexao />
      {instalavel && <ConviteInstalar />}
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  );
}

function Conteudo() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path.startsWith("/c/")) return <Outlet />;
  const mostraAbas = !path.startsWith("/.lovable/") && !path.startsWith("/trip/") && !path.startsWith("/pessoas/") && path !== "/nova-viagem";
  return (
    <AuthGate>
      <BaixarOffline />
      <Outlet />
      {mostraAbas && <AbasApp />}
    </AuthGate>
  );
}
