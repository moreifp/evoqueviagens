import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { buscarAeroportos, carregarAeroportos, porIata, type Aeroporto } from "@/lib/aeroportos";
import { inputCls } from "@/components/Form";

/** Digitar o código (GRU) ou a cidade: escolher preenche cidade e fuso sozinhos. Funciona sem internet. */
export function CampoAeroporto({
  rotulo,
  iata,
  onEscolher,
}: {
  rotulo: string;
  iata: string;
  onEscolher: (a: { iata: string; cidade: string | null; tz: string | null }) => void;
}) {
  const [lista, setLista] = useState<Aeroporto[]>([]);
  const [texto, setTexto] = useState(iata);
  const [foco, setFoco] = useState(false);
  useEffect(() => {
    void carregarAeroportos().then(setLista);
  }, []);
  useEffect(() => setTexto(iata), [iata]);

  const atual = porIata(lista, texto);
  const sugestoes = foco && !atual ? buscarAeroportos(lista, texto) : [];

  function escolher(a: Aeroporto) {
    setTexto(a.iata);
    setFoco(false);
    onEscolher({ iata: a.iata, cidade: a.cidade || null, tz: a.tz });
  }

  return (
    <div className="relative">
      <span className="block text-base font-bold text-foreground">{rotulo}</span>
      <input
        value={texto}
        placeholder="GRU ou cidade"
        autoCapitalize="characters"
        onFocus={() => setFoco(true)}
        onBlur={() => setTimeout(() => setFoco(false), 150)}
        onChange={(e) => {
          const v = e.target.value;
          setTexto(v);
          const a = porIata(lista, v);
          if (a) onEscolher({ iata: a.iata, cidade: a.cidade || null, tz: a.tz });
          else if (/^[A-Za-z]{3}$/.test(v)) onEscolher({ iata: v.toUpperCase(), cidade: null, tz: null });
        }}
        className={`${inputCls} mt-2 mono-code uppercase`}
      />
      {atual && (
        <p className="mt-1 text-base font-semibold text-muted-foreground">
          {atual.cidade || atual.nome} · {atual.tz.split("/").pop()?.replace(/_/g, " ")}
        </p>
      )}
      {sugestoes.length > 0 && (
        <ul className="shadow-medium absolute inset-x-0 z-30 mt-1 overflow-hidden rounded-xl border-2 border-border bg-card">
          {sugestoes.map((a) => (
            <li key={a.iata}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(a)}
                className="tap flex w-full items-center gap-3 px-4 text-left"
              >
                <MapPin size={22} strokeWidth={2.2} className="shrink-0 text-accent" />
                <span className="mono-code text-lg font-bold">{a.iata}</span>
                <span className="truncate text-base text-muted-foreground">{a.cidade || a.nome}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
