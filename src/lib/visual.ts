import { useSyncExternalStore } from "react";

/** Chave "Visual" (Eu): "colorido" (padrão) ou "classico" (visual anterior). Fica só no aparelho. */
export type Visual = "colorido" | "classico";
const CHAVE = "evoque-visual";
const ouvintes = new Set<() => void>();

export function lerVisual(): Visual {
  if (typeof localStorage === "undefined") return "colorido";
  return localStorage.getItem(CHAVE) === "classico" ? "classico" : "colorido";
}

export function aplicarVisual(v: Visual = lerVisual()) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("visual-classico", v === "classico");
}

export function mudarVisual(v: Visual) {
  localStorage.setItem(CHAVE, v);
  aplicarVisual(v);
  ouvintes.forEach((f) => f());
}

export function useVisual(): Visual {
  return useSyncExternalStore(
    (f) => { ouvintes.add(f); return () => ouvintes.delete(f); },
    lerVisual,
    () => "colorido",
  );
}

/** true quando o visual novo (colorido) está ligado. */
export function useColorido() {
  return useVisual() === "colorido";
}
