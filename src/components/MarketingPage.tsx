import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
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

    const closeMenu = () => {
      nav?.classList.remove("open");
      menu?.setAttribute("aria-expanded", "false");
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [html]);

  const handleClick = async (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    const root = rootRef.current;
    if (!root) return;
    const menu = root.querySelector<HTMLButtonElement>(".menu-toggle");
    const nav = root.querySelector<HTMLElement>(".mobile-nav");

    if (target.closest(".menu-toggle")) {
      const open = menu?.getAttribute("aria-expanded") !== "true";
      menu?.setAttribute("aria-expanded", String(open));
      nav?.classList.toggle("open", open);
      return;
    }
    if (target.closest(".mobile-nav a")) {
      menu?.setAttribute("aria-expanded", "false");
      nav?.classList.remove("open");
    }
    if (target.closest(".theme-toggle")) {
      setTheme((current) => {
        const next = current === "dark" ? "light" : "dark";
        try {
          window.localStorage.setItem(THEME_KEY, next);
        } catch {
          // Theme still changes for this visit.
        }
        return next;
      });
      return;
    }
    const copyButton = target.closest<HTMLButtonElement>("[data-copy]");
    if (!copyButton) return;
    const status = copyButton.parentElement?.nextElementSibling;
    try {
      await navigator.clipboard.writeText(copyButton.dataset.copy ?? "");
      if (status) status.textContent = isEnglish ? "Copied." : "Copiado.";
    } catch {
      if (status) status.textContent = isEnglish ? "Select and copy the text above." : "Selecione e copie o texto acima.";
    }
  };

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
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
