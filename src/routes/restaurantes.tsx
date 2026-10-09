import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Utensils, WifiOff, RotateCw } from "lucide-react";
import { tokenRestaurants } from "@/lib/restaurants.functions";

export const Route = createFileRoute("/restaurantes")({
  head: () => ({
    meta: [
      { title: "Restaurantes — Evoque Viagens" },
      { name: "description", content: "Seus restaurantes no Evoque, dentro do app de viagens." },
      { property: "og:title", content: "Restaurantes — Evoque Viagens" },
      {
        property: "og:description",
        content: "Seus restaurantes no Evoque, dentro do app de viagens.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Restaurantes,
});

function expDe(token: string): number | null {
  try {
    const p = JSON.parse(atob(token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as {
      exp?: number;
    };
    return typeof p.exp === "number" ? p.exp * 1000 : null;
  } catch {
    return null;
  }
}

function Restaurantes() {
  const pedir = useServerFn(tokenRestaurants);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const alvo = useRef<{ url: string; clientId: string } | null>(null);
  const timer = useRef<number | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    if (!navigator.onLine) {
      setErro("Sem internet · Restaurantes precisa de conexão.");
      return;
    }
    async function buscar(inicial: boolean, repetindo = false) {
      try {
        const r = await pedir();
        if (!vivo) return;
        if ("erro" in r) {
          setErro(
            r.erro === "email_nao_confirmado"
              ? "Seu e-mail ainda não foi confirmado. Confirme para abrir Restaurantes."
              : "Restaurantes ainda está sendo ligado. Volte em breve.",
          );
          return;
        }
        alvo.current = { url: r.url, clientId: r.clientId };
        if (inicial) {
          setSrc(
            `${r.url}/embed?token=${encodeURIComponent(r.token)}&client_id=${encodeURIComponent(r.clientId)}`,
          );
        } else {
          // Renovação sem recarregar: manda o token novo para o app aberto.
          iframeRef.current?.contentWindow?.postMessage(
            { type: "evoque:refresh-token", token: r.token, client_id: r.clientId },
            new URL(r.url).origin,
          );
        }
        const vida = Math.max(0, (expDe(r.token) ?? Date.now() + 300_000) - Date.now());
        timer.current = window.setTimeout(
          () => buscar(false),
          Math.min(Math.max(vida * 0.6, 30_000), 300_000),
        );
      } catch (e) {
        console.error(e);
        if (!vivo) return;
        if (inicial) setErro("Não deu para abrir Restaurantes agora.");
        else if (!repetindo) timer.current = window.setTimeout(() => buscar(false, true), 30_000);
      }
    }
    void buscar(true);
    return () => {
      vivo = false;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [tentativa]);

  useEffect(() => {
    const ouvir = (e: MessageEvent) => {
      const a = alvo.current;
      if (!a || e.origin !== new URL(a.url).origin) return;
      if (
        e.data?.type === "evoque:open-external" &&
        typeof e.data.url === "string" &&
        /^https:\/\//.test(e.data.url)
      ) {
        window.open(e.data.url, "_blank", "noopener");
      }
    };
    window.addEventListener("message", ouvir);
    return () => window.removeEventListener("message", ouvir);
  }, []);

  if (erro) {
    return (
      <div className="min-h-screen bg-background pb-32">
        <header className="px-4 py-3">
          <h1 className="text-3xl">Restaurantes</h1>
        </header>
        <div className="mx-4 mt-10 flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border p-8 text-center">
          {navigator.onLine ? (
            <Utensils size={48} strokeWidth={2.2} className="text-accent" />
          ) : (
            <WifiOff size={48} strokeWidth={2.2} className="text-accent" />
          )}
          <p className="text-xl font-bold text-foreground">{erro}</p>
          <button
            onClick={() => {
              setErro(null);
              setSrc(null);
              setTentativa((n) => n + 1);
            }}
            className="tap flex items-center gap-2 rounded-2xl border-2 border-input bg-card px-6 text-lg font-bold"
          >
            <RotateCw size={24} strokeWidth={2.2} /> Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 top-0 bottom-[calc(72px+env(safe-area-inset-bottom))] bg-background">
      {!src && (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
          <Utensils size={40} strokeWidth={2.2} className="animate-pulse text-accent" />
          <p className="text-lg font-semibold">Abrindo Restaurantes…</p>
        </div>
      )}
      {src && (
        <iframe
          ref={iframeRef}
          src={src}
          title="Evoque Restaurants"
          className="h-full w-full border-0"
          allow="geolocation; camera; microphone; clipboard-write; web-share"
          referrerPolicy="strict-origin"
        />
      )}
    </div>
  );
}
