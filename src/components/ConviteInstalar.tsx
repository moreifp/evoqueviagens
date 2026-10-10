import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type EventoInstalar = Event & { prompt: () => Promise<void> };
const CHAVE = "evoque-convite-instalar";

/** Convite, uma vez só, para colocar o app na tela de início. */
export function ConviteInstalar() {
  const [modo, setModo] = useState<"android" | "ios" | null>(null);
  const [evento, setEvento] = useState<EventoInstalar | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(CHAVE)) return;
    } catch {
      return;
    }
    const instalado =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone;
    if (instalado || window.self !== window.top) return;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    let t: ReturnType<typeof setTimeout> | undefined;
    if (ios) t = setTimeout(() => setModo("ios"), 5000);
    const antes = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
      setModo("android");
    };
    window.addEventListener("beforeinstallprompt", antes);
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", antes);
    };
  }, []);

  function fechar() {
    try {
      localStorage.setItem(CHAVE, String(Date.now()));
    } catch {
      /* ignora */
    }
    setModo(null);
  }

  if (!modo) return null;
  return (
    <div
      role="region"
      aria-label="Adicionar à tela de início"
      className="fixed inset-x-3 bottom-24 z-40 rounded-2xl border border-border bg-card p-4 shadow-medium"
    >
      <p className="text-lg font-bold text-foreground">Use o Viagens Organizadas sem internet</p>
      <p className="mt-1 text-base text-muted-foreground">
        {modo === "ios"
          ? "No iPhone: toque em Compartilhar → Adicionar à Tela de Início."
          : "Coloque o app na tela de início para abrir no avião."}
      </p>
      <div className="mt-3 flex gap-3">
        {modo === "android" && evento && (
          <button
            onClick={async () => {
              await evento.prompt().catch(() => {});
              fechar();
            }}
            className="tap flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-lg font-bold text-primary-foreground"
          >
            <Download size={24} strokeWidth={2.2} /> Adicionar
          </button>
        )}
        {modo === "ios" && (
          <span className="flex flex-1 items-center gap-2 text-base font-semibold text-foreground">
            <Share size={24} strokeWidth={2.2} /> Compartilhar
          </span>
        )}
        <button
          onClick={fechar}
          className="tap flex items-center justify-center gap-2 rounded-xl border-2 border-border px-5 text-lg font-bold text-foreground"
        >
          <X size={24} strokeWidth={2.2} /> Agora não
        </button>
      </div>
    </div>
  );
}
