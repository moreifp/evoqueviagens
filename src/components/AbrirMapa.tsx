import { useState } from "react";
import { Map, Navigation } from "lucide-react";
import {
  linkApple,
  linkGoogle,
  localizacaoAgora,
  rotaApple,
  rotaGoogle,
  type Ponto,
} from "@/lib/mapas";

/** "Abrir no mapa" e "Como chegar", com escolha Google Maps / Apple Maps. Sem mapa embutido. */
export function AbrirMapa({ ponto }: { ponto: Ponto }) {
  const [modo, setModo] = useState<null | "ver" | "rota">(null);
  const [buscando, setBuscando] = useState(false);
  if (!ponto.lat && !ponto.endereco && !ponto.place_id) return null;

  async function abrir(app: "google" | "apple") {
    if (modo === "ver") {
      window.open(app === "google" ? linkGoogle(ponto) : linkApple(ponto), "_blank", "noopener");
    } else {
      setBuscando(true);
      const aqui = await localizacaoAgora();
      setBuscando(false);
      window.open(
        app === "google" ? rotaGoogle(ponto, aqui) : rotaApple(ponto, aqui),
        "_blank",
        "noopener",
      );
    }
    setModo(null);
  }

  const btn =
    "tap flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-border bg-card text-lg font-bold text-foreground";
  return (
    <section className="space-y-2">
      {ponto.endereco && <p className="text-lg text-muted-foreground">{ponto.endereco}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setModo(modo === "ver" ? null : "ver")}
          className={btn}
          aria-expanded={modo === "ver"}
        >
          <Map size={24} /> Abrir no mapa
        </button>
        <button
          type="button"
          onClick={() => setModo(modo === "rota" ? null : "rota")}
          className={btn}
          aria-expanded={modo === "rota"}
        >
          <Navigation size={24} /> Como chegar
        </button>
      </div>
      {modo && (
        <div className="rounded-xl border-2 border-accent bg-card p-3">
          <p className="mb-2 text-base font-bold">
            {modo === "ver"
              ? "Abrir em qual app?"
              : buscando
                ? "Pegando sua localização…"
                : "Rota em qual app? (sua localização não é guardada)"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={buscando}
              onClick={() => void abrir("google")}
              className={btn}
            >
              Google Maps
            </button>
            <button
              type="button"
              disabled={buscando}
              onClick={() => void abrir("apple")}
              className={btn}
            >
              Apple Maps
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
