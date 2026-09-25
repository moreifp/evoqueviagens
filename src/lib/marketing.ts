export const MARKETING_ROUTES = new Set([
  "/",
  "/en",
  "/privacidade",
  "/termos",
  "/contato",
  "/conectar-assistente",
  "/en/privacy",
  "/en/terms",
  "/en/contact",
  "/en/connect-assistant",
  "/landing-preview",
]);

export function ehRotaMarketing(path: string) {
  const normalized = path.length > 1 ? path.replace(/\/$/, "") : path;
  return MARKETING_ROUTES.has(normalized);
}

export function rotaMarketingPublica(path: string) {
  const normalized = path.length > 1 ? path.replace(/\/$/, "") : path;
  return normalized !== "/" && MARKETING_ROUTES.has(normalized);
}
