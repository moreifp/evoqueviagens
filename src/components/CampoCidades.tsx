import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Search, X } from "lucide-react";
import { autocompletarLugar, type Sugestao } from "@/lib/lugares.functions";
import { inputCls } from "@/components/Form";

/**
 * Várias cidades como chips. Busca só cidades no Google (300 ms depois da última tecla, mínimo 3 letras).
 * Escolher a sugestão não gasta chamada de detalhe: só o nome da cidade é guardado.
 * Sem internet (ou sem sugestão), Enter ou vírgula adiciona o texto como está.
 */
export function CampoCidades({ cidades, onChange }: { cidades: string[]; onChange: (c: string[]) => void }) {
  const buscar = useServerFn(autocompletarLugar);
  const [texto, setTexto] = useState("");
  const [sug, setSug] = useState<Sugestao[]>([]);
  const [online, setOnline] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const sessao = useRef<string | null>(null);
  const pedido = useRef(0);

  useEffect(() => {
    const at = () => setOnline(navigator.onLine);
    at(); window.addEventListener("online", at); window.addEventListener("offline", at);
    return () => { window.removeEventListener("online", at); window.removeEventListener("offline", at); };
  }, []);

  useEffect(() => {
    const q = texto.trim();
    if (!online || q.length < 3) { setSug([]); return; }
    const n = ++pedido.current;
    const t = setTimeout(() => {
      sessao.current ??= crypto.randomUUID();
      buscar({ data: { texto: q, sessao: sessao.current, tipo: "cidade" } })
        .then((r) => { if (n === pedido.current) { setSug(r); setErro(null); } })
        .catch((e: Error) => { if (n === pedido.current) { setSug([]); setErro(e.message || "Busca indisponível · digite e toque Enter."); } });
    }, 300);
    return () => clearTimeout(t);
  }, [texto, online, buscar]);

  function add(nome: string) {
    const c = nome.trim();
    if (c && !cidades.some((x) => x.toLowerCase() === c.toLowerCase())) onChange([...cidades, c]);
    setTexto(""); setSug([]); sessao.current = null;
  }

  return (
    <div className="space-y-2">
      {cidades.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {cidades.map((c) => (
            <li key={c}>
              <button type="button" onClick={() => onChange(cidades.filter((x) => x !== c))} aria-label={`Tirar ${c}`}
                className="flex min-h-[48px] items-center gap-2 rounded-full border-2 border-accent bg-muted px-4 text-lg font-bold">
                {c} <X size={20} strokeWidth={2.4} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        {online && <Search size={22} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />}
        <input
          value={texto}
          onChange={(e) => { const v = e.target.value; if (v.endsWith(",")) add(v.slice(0, -1)); else setTexto(v); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (sug[0] && online) add(sug[0].texto.split(",")[0] ?? ""); else add(texto); } }}
          onBlur={() => setTimeout(() => { if (!sug.length && texto.trim()) add(texto); }, 250)}
          placeholder={online ? (cidades.length ? "Outra cidade" : "Digite a cidade para buscar") : "Sem internet · digite e toque Enter"}
          autoComplete="off"
          aria-label="Cidade"
          className={`${inputCls} ${online ? "pl-12" : ""}`}
        />
        {sug.length > 0 && (
          <ul role="listbox" className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border-2 border-border bg-card shadow-medium">
            {sug.map((s) => (
              <li key={s.place_id}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(s.texto.split(",")[0] ?? "")}
                  className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left text-lg hover:bg-muted">
                  <MapPin size={22} className="shrink-0 text-accent" /> {s.texto}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {erro && <p className="text-base text-muted-foreground">{erro}</p>}
    </div>
  );
}
