/** Endereços de produção e regras por domínio (landing × app). */
export const APP_URL = "https://app.evoque.global";
export const APP_HOST = "app.evoque.global";
export const LANDING_URL = "https://evoque.global";

/** Domínios onde "/" é a landing e as telas vão para o app. */
export const HOSTS_LANDING = new Set(["evoque.global", "www.evoque.global"]);
/** Domínios que só redirecionam as telas para o app (sem landing). */
export const HOSTS_SO_REDIRECIONA = new Set(["evoqueviagens.lovable.app"]);

export function limparHost(h: string | null | undefined): string {
  return (h ?? "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

export function ehHostLanding(host: string) {
  return HOSTS_LANDING.has(limparHost(host));
}

/** Caminhos que nunca redirecionam: MCP, OAuth, API, arquivos e funções do servidor. */
export function caminhoLivre(path: string) {
  return (
    path === "/mcp" ||
    path.startsWith("/mcp/") ||
    path.startsWith("/.well-known/") ||
    path.startsWith("/.lovable/") ||
    path.startsWith("/api/") ||
    path.startsWith("/~") ||
    path.startsWith("/_serverFn") ||
    path.startsWith("/_build") ||
    path.startsWith("/assets/") ||
    path.startsWith("/@") ||
    /\.[a-z0-9]{2,12}$/i.test(path)
  );
}

/** Destino 301 para esta requisição, ou null se ela segue normal. */
export function destinoRedirecionamento(host: string, path: string, search: string): string | null {
  const h = limparHost(host);
  const landing = HOSTS_LANDING.has(h);
  if (!landing && !HOSTS_SO_REDIRECIONA.has(h)) return null;
  if (caminhoLivre(path)) return null;
  if (landing && path === "/") return null;
  return `${APP_URL}${path}${search}`;
}

/** Origem para links enviados a outras pessoas: sempre o app em produção. */
export function origemApp(): string {
  if (typeof window === "undefined") return APP_URL;
  const h = window.location.hostname;
  if (h === APP_HOST || HOSTS_LANDING.has(h) || HOSTS_SO_REDIRECIONA.has(h)) return APP_URL;
  return window.location.origin;
}
