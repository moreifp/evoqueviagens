import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { autocompletarLugar, detalhesLugar, type Lugar, type Sugestao } from "@/lib/lugares.functions";
import { inputCls } from "@/components/Form";

/**
 * Campo de texto com busca de lugares. Espera 600 ms depois da última tecla, pede no mínimo 3 letras
 * e usa uma sessão por busca (as buscas + o detalhe escolhido contam como uma sessão no Google).
 * Sem internet vira um campo de texto normal.
 */
export function CampoLugar({
  valor,
  onTexto,
  onEscolher,
  perto,
  placeholder,
  mono,
}: {
  valor: string;
  onTexto: (v: string) => void;
  onEscolher: (l: Lugar) => void;
  perto?: string;
  placeholder?: string;
  mono?: boolean;
}) {
  const buscar = useServerFn(autocompletarLugar);
  const detalhar = useServerFn(detalhesLugar);
  const [sug, setSug] = useState<Sugestao[]>([]);
  const [aberto, setAberto] = useState(false);
  const [online, setOnline] = useState(true);
  const sessao = useRef<string | null>(null);
  const pedido = useRef(0);
  const digitou = useRef(false);

  useEffect(() => {
    const atualizar = () => setOnline(navigator.onLine);
    atualizar();
    window.addEventListener("online", atualizar);
    window.addEventListener("offline", atualizar);
    return () => {
      window.removeEventListener("online", atualizar);
      window.removeEventListener("offline", atualizar);
    };
  }, []);

  useEffect(() => {
    if (!digitou.current || !online || valor.trim().length < 3) {
      setSug([]);
      return;
    }
    const n = ++pedido.current;
    const t = setTimeout(() => {
      sessao.current ??= crypto.randomUUID();
      buscar({ data: { texto: valor.trim(), sessao: sessao.current, perto: perto || undefined } })
        .then((r) => {
          if (n === pedido.current) {
            setSug(r);
            setAberto(true);
          }
        })
        .catch(() => n === pedido.current && setSug([]));
    }, 600);
    return () => clearTimeout(t);
  }, [valor, online, perto, buscar]);

  async function escolher(s: Sugestao) {
    setAberto(false);
    setSug([]);
    digitou.current = false;
    const tok = sessao.current ?? crypto.randomUUID();
    sessao.current = null;
    try {
      onEscolher(await detalhar({ data: { place_id: s.place_id, sessao: tok } }));
    } catch (e) {
      onTexto(s.texto);
      toast.error((e as Error).message || "Não deu para buscar o endereço. Fica o texto.");
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        {online && <Search size={22} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />}
        <input
          value={valor}
          placeholder={online ? (placeholder ?? "Digite para buscar") : "Sem internet · digite normalmente"}
          onChange={(e) => {
            digitou.current = true;
            onTexto(e.target.value);
          }}
          onBlur={() => setTimeout(() => setAberto(false), 200)}
          onFocus={() => sug.length && setAberto(true)}
          autoComplete="off"
          className={`${inputCls} ${online ? "pl-12" : ""} ${mono ? "mono-code" : ""}`}
        />
      </div>
      {aberto && sug.length > 0 && (
        <ul role="listbox" className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border-2 border-border bg-card shadow-medium">
          {sug.map((s) => (
            <li key={s.place_id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => void escolher(s)} className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left text-lg hover:bg-muted">
                <MapPin size={22} className="shrink-0 text-accent" /> {s.texto}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
