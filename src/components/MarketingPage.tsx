import { useEffect, useMemo, useRef, useState } from "react";
import coastAsset from "@/assets/marketing/coast-editorial.webp.asset.json";
import trainAsset from "@/assets/marketing/train-editorial.webp.asset.json";
import { HOSTS_LANDING } from "@/lib/site";
import { marketingHtml, type MarketingPageKey } from "./marketing-content";
import "./marketing.css";

const THEME_KEY = "evoque-landing-theme";

type MarketingPageProps = {
  page: MarketingPageKey;
  preview?: boolean;
};

function initialTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Storage can be disabled; the system preference remains available.
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function prepareHtml(page: MarketingPageKey, preview: boolean) {
  let html = marketingHtml[page]
    .replaceAll("__COAST__", coastAsset.url)
    .replaceAll("__TRAIN__", trainAsset.url);

  if (preview) {
    html = html
      .replaceAll('href="/#', 'href="/landing-preview#')
      .replaceAll('href="/"', 'href="/landing-preview"');
  }
  return html;
}

export function MarketingPage({ page, preview = false }: MarketingPageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const isEnglish = page.endsWith("-en");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [reviewHost, setReviewHost] = useState(false);
  const html = useMemo(() => prepareHtml(page, preview || reviewHost), [page, preview, reviewHost]);

  useEffect(() => setTheme(initialTheme()), []);
  useEffect(() => setReviewHost(!HOSTS_LANDING.has(window.location.hostname)), []);

  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = isEnglish ? "en" : "pt-BR";
    return () => {
      document.documentElement.lang = previous;
    };
  }, [isEnglish]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const menu = root.querySelector<HTMLButtonElement>(".menu-toggle");
    const nav = root.querySelector<HTMLElement>(".mobile-nav");
    const themeButton = root.querySelector<HTMLButtonElement>(".theme-toggle");

    const closeMenu = () => {
      nav?.classList.remove("open");
      menu?.setAttribute("aria-expanded", "false");
    };
    const toggleMenu = () => {
      const open = menu?.getAttribute("aria-expanded") !== "true";
      menu?.setAttribute("aria-expanded", String(open));
      nav?.classList.toggle("open", open);
    };
    const handleNavClick = (event: Event) => {
      if ((event.target as Element | null)?.closest("a")) closeMenu();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    const toggleTheme = () => {
      setTheme((current) => {
        const next = current === "dark" ? "light" : "dark";
        try {
          window.localStorage.setItem(THEME_KEY, next);
        } catch {
          // Theme still changes for this visit.
        }
        return next;
      });
    };
    const handleCopy = async (event: Event) => {
      const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-copy]");
      if (!button) return;
      const status = button.parentElement?.nextElementSibling;
      try {
        await navigator.clipboard.writeText(button.dataset.copy ?? "");
        if (status) status.textContent = isEnglish ? "Copied." : "Copiado.";
      } catch {
        if (status) status.textContent = isEnglish ? "Select and copy the text above." : "Selecione e copie o texto acima.";
      }
    };

    menu?.addEventListener("click", toggleMenu);
    nav?.addEventListener("click", handleNavClick);
    themeButton?.addEventListener("click", toggleTheme);
    root.addEventListener("click", handleCopy);
    document.addEventListener("keydown", handleKey);
    return () => {
      menu?.removeEventListener("click", toggleMenu);
      nav?.removeEventListener("click", handleNavClick);
      themeButton?.removeEventListener("click", toggleTheme);
      root.removeEventListener("click", handleCopy);
      document.removeEventListener("keydown", handleKey);
    };
  }, [html, isEnglish]);

  useEffect(() => {
    const button = rootRef.current?.querySelector<HTMLButtonElement>(".theme-toggle");
    if (!button) return;
    button.textContent = theme === "dark"
      ? (isEnglish ? "Light appearance" : "Aparência clara")
      : (isEnglish ? "Dark appearance" : "Aparência escura");
    button.setAttribute("aria-pressed", String(theme === "dark"));
  }, [isEnglish, theme]);

  return (
    <div
      ref={rootRef}
      className="marketing-site"
      data-theme={theme}
      lang={isEnglish ? "en" : "pt-BR"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
