import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Search } from "lucide-react";
import { MAIS_USADAS, TODAS_MOEDAS, acharMoeda, buscarMoedas } from "@/lib/moedas";
import { inputCls } from "@/components/Form";

const CHAVE = "evoque-moedas-usadas";

/** Moedas já usadas nas viagens/despesas em cache + escolhidas recentemente. */
function usadasDoAparelho(qc: ReturnType<typeof useQueryClient>): string[] {
  const set = new Set<string>();
  try {
    (JSON.parse(localStorage.getItem(CHAVE) ?? "[]") as string[]).forEach((c) => set.add(c));
  } catch {
    /* vazio */
  }
  for (const [, dados] of qc.getQueriesData<unknown>({})) {
    const lista = Array.isArray(dados) ? dados : [];
    for (const x of lista.slice(0, 200)) {
      const r = x as Record<string, unknown> | null;
      for (const k of ["moeda_base", "moeda_original", "moeda"])
        if (r && typeof r[k] === "string") set.add(String(r[k]).toUpperCase());
    }
  }
  return [...set].filter((c) => acharMoeda(c));
}

export function CampoMoeda({
  value,
  onChange,
  rotulo = "Moeda",
  name,
}: {
  value: string;
  onChange: (codigo: string) => void;
  rotulo?: string;
  name?: string;
}) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [q, setQ] = useState("");
  const [usadas, setUsadas] = useState<string[]>([]);
  useEffect(() => {
    if (aberto) setUsadas(usadasDoAparelho(qc));
  }, [aberto, qc]);
  const atual = acharMoeda(value);
  const topo = useMemo(
    () => [...new Set([...MAIS_USADAS, ...usadas])].map((c) => acharMoeda(c)!).filter(Boolean),
    [usadas],
  );
  const resultado = useMemo(
    () => (q.trim() ? buscarMoedas(q) : TODAS_MOEDAS.filter((m) => !topo.includes(m))),
    [q, topo],
  );

  function escolher(c: string) {
    onChange(c);
    try {
      const l = [
        c,
        ...(JSON.parse(localStorage.getItem(CHAVE) ?? "[]") as string[]).filter((x) => x !== c),
      ].slice(0, 8);
      localStorage.setItem(CHAVE, JSON.stringify(l));
    } catch {
      /* sem storage */
    }
    setAberto(false);
    setQ("");
  }
  const linha = (m: (typeof TODAS_MOEDAS)[number]) => (
    <li key={m.codigo}>
      <button
        type="button"
        onClick={() => escolher(m.codigo)}
        className="tap flex w-full items-center gap-3 px-4 py-2 text-left text-lg hover:bg-muted"
      >
        <span className="text-2xl" aria-hidden>
          {m.bandeira}
        </span>
        <span className="flex-1">
          <strong className="num">{m.codigo}</strong> · {m.nome}
          <span className="block text-base text-muted-foreground">
            {m.paises.slice(0, 3).join(", ")}
            {m.paises.length > 3 ? "…" : ""}
          </span>
        </span>
        {m.codigo === value && <Check size={24} strokeWidth={2.2} />}
      </button>
    </li>
  );

  return (
    <div>
      <span className="mb-2 block text-lg font-semibold">{rotulo}</span>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className={`${inputCls} flex items-center gap-3 text-left`}
      >
        <span className="text-2xl" aria-hidden>
          {atual?.bandeira}
        </span>
        <span className="flex-1 truncate">
          <strong>{value}</strong>
          {atual ? ` · ${atual.nome}` : ""}
        </span>
        <ChevronDown size={24} strokeWidth={2.2} />
      </button>
      {aberto && (
        <div className="mt-2 rounded-2xl border-2 border-border bg-card">
          <label className="flex items-center gap-2 border-b border-border px-4">
            <Search size={22} strokeWidth={2.2} aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Código, nome ou país (ex.: rand, ZAR)"
              aria-label="Buscar moeda"
              className="min-h-14 w-full bg-transparent text-lg outline-none"
            />
          </label>
          <ul className="max-h-80 overflow-y-auto py-1">
            {!q.trim() && (
              <>
                <li className="px-4 pt-2 text-base font-bold text-muted-foreground">Mais usadas</li>
                {topo.map(linha)}
                <li className="px-4 pt-3 text-base font-bold text-muted-foreground">Todas</li>
              </>
            )}
            {resultado.map(linha)}
            {q.trim() && !resultado.length && (
              <li className="px-4 py-3 text-lg">Nenhuma moeda encontrada.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
