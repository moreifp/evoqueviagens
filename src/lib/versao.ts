declare const __EVOQUE_BUILD__: string;

/**
 * Data/hora (UTC) em que este build do app foi gerado.
 * Muda a cada build/publicação — usada na indicação discreta de versão.
 */
export function versaoBuild(): string {
  const iso = typeof __EVOQUE_BUILD__ !== "undefined" ? __EVOQUE_BUILD__ : "";
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${data} · ${hora} UTC`;
}
