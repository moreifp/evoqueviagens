import { useEffect, useState } from "react";
import { Check, Equal, Hash, Percent, PieChart, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { dividir, type ModoDivisao } from "@/lib/divisao";
import { fmtMoney } from "@/lib/format";

export type PessoaDiv = { id: string; nome: string; fora?: boolean };
export type Divisao = { modo: ModoDivisao; incluidos: string[]; pesos: Record<string, string> };

export function calcularDivisao(totalC: number, pessoas: PessoaDiv[], d: Divisao) {
  const lista = d.modo === "igual"
    ? pessoas.filter((p) => d.incluidos.includes(p.id)).map((p) => ({ id: p.id, peso: 1 }))
    : pessoas.map((p) => ({ id: p.id, peso: Number((d.pesos[p.id] ?? "").replace(",", ".")) || 0 })).filter((p) => p.peso > 0);
  return { lista, ...dividir(totalC, lista, d.modo) };
}

export const fraseCentavos = (n: number) => (n > 0 ? `${n} ${n === 1 ? "pessoa paga" : "pessoas pagam"} 1 centavo a mais` : "");

const ABAS: { id: ModoDivisao; rotulo: string; Icone: typeof Equal }[] = [
  { id: "igual", rotulo: "Igual", Icone: Equal },
  { id: "valor", rotulo: "Valor", Icone: Hash },
  { id: "pct", rotulo: "%", Icone: Percent },
  { id: "cotas", rotulo: "Cotas", Icone: PieChart },
];

export function FolhaDivisao({ aberta, onFechar, totalC, moeda, pessoas, valor, onPronto }: {
  aberta: boolean; onFechar: () => void; totalC: number; moeda: string; pessoas: PessoaDiv[]; valor: Divisao; onPronto: (d: Divisao) => void;
}) {
  const [d, setD] = useState<Divisao>(valor);
  const [fixos, setFixos] = useState<Set<string>>(new Set());
  useEffect(() => { if (aberta) { setD(valor); setFixos(new Set(Object.keys(valor.pesos).filter((k) => valor.pesos[k]))); } }, [aberta]); // eslint-disable-line react-hooks/exhaustive-deps
  const r = calcularDivisao(totalC, pessoas, d);
  const fecha = r.fecha && r.lista.length > 0;

  /** Aba Valor: ao fixar o valor de uma pessoa, divide o resto igual entre as demais. */
  function mudarValor(pid: string, txt: string) {
    const pesos = { ...d.pesos, [pid]: txt };
    const novosFixos = new Set(fixos);
    if (txt.trim()) novosFixos.add(pid); else novosFixos.delete(pid);
    const somaFixos = [...novosFixos].reduce((a, p) => a + Math.round((Number((pesos[p] ?? "").replace(",", ".")) || 0) * 100), 0);
    const livres = pessoas.map((p) => p.id).filter((x) => !novosFixos.has(x));
    if (livres.length > 0) {
      const resto = Math.max(0, totalC - somaFixos);
      const base = Math.floor(resto / livres.length);
      livres.forEach((x, i) => { pesos[x] = ((base + (i < resto % livres.length ? 1 : 0)) / 100).toFixed(2); });
    }
    setFixos(novosFixos);
    setD({ ...d, pesos });
  }

  return (
    <Drawer open={aberta} onOpenChange={(o) => !o && onFechar()}>
      <DrawerContent className="max-h-[92vh]">
        <div className="flex items-center gap-2 px-4 pt-2">
          <DrawerTitle className="flex-1 text-2xl">Como dividir</DrawerTitle>
          <button onClick={onFechar} aria-label="Fechar" className="tap flex items-center justify-center rounded-xl text-foreground"><X size={28} strokeWidth={2.2} /></button>
        </div>
        <div className="grid grid-cols-4 gap-2 px-4 pt-3">
          {ABAS.map(({ id, rotulo, Icone }) => (
            <button key={id} onClick={() => setD({ ...d, modo: id })} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border-2 text-sm font-bold ${d.modo === id ? "border-navy bg-navy text-primary-foreground" : "border-border bg-card text-foreground"}`}>
              <Icone size={24} strokeWidth={2.2} /> {rotulo}
            </button>
          ))}
        </div>
        <ul className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {pessoas.map((p) => {
            const parte = r.partes.get(p.id);
            if (d.modo === "igual") {
              const dentro = d.incluidos.includes(p.id);
              return (
                <li key={p.id}>
                  <button onClick={() => setD({ ...d, incluidos: dentro ? d.incluidos.filter((x) => x !== p.id) : [...d.incluidos, p.id] })} className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-3 text-left ${dentro ? "border-teal bg-card" : "border-border bg-muted"}`}>
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${dentro ? "border-teal bg-teal text-primary-foreground" : "border-border"}`}>{dentro && <Check size={20} strokeWidth={2.6} />}</span>
                    <span className="flex-1 text-lg font-bold text-foreground">{p.nome}</span>
                    <span className="num text-lg text-foreground">{dentro && parte != null ? fmtMoney(parte / 100, moeda) : p.fora ? "fora" : "—"}</span>
                  </button>
                </li>
              );
            }
            return (
              <li key={p.id} className="flex min-h-14 items-center gap-3 rounded-2xl border-2 border-border bg-card px-3">
                <span className="flex-1 text-lg font-bold text-foreground">{p.nome}{p.fora && <span className="ml-2 text-sm text-muted-foreground">entrou depois</span>}</span>
                <input inputMode="decimal" aria-label={`${d.modo === "valor" ? "Valor" : d.modo === "pct" ? "Porcentagem" : "Cotas"} de ${p.nome}`} value={d.pesos[p.id] ?? ""} onChange={(e) => setD({ ...d, pesos: { ...d.pesos, [p.id]: e.target.value } })} placeholder={d.modo === "valor" ? moeda : d.modo === "pct" ? "%" : "cotas"} className="h-12 w-24 rounded-xl border-2 border-input bg-background px-2 text-right text-lg font-bold text-foreground" />
                {d.modo !== "valor" && <span className="num w-24 text-right text-base text-muted-foreground">{parte != null ? fmtMoney(parte / 100, moeda) : ""}</span>}
              </li>
            );
          })}
        </ul>
        <div className="space-y-2 border-t border-border px-4 pb-6 pt-3">
          <p className={`rounded-xl px-3 py-3 text-lg font-bold ${fecha ? "bg-ok text-ok-foreground" : "bg-danger text-danger-foreground"}`}>
            {fecha ? `Fecha: ${fmtMoney(totalC / 100, moeda)} · ${r.lista.length} ${r.lista.length === 1 ? "pessoa" : "pessoas"}` : r.diferencaC < 0 ? `Sobram ${fmtMoney(-r.diferencaC / 100, moeda)}` : `Faltam ${fmtMoney(r.diferencaC / 100, moeda)}`}
          </p>
          {fecha && r.extras > 0 && <p className="text-base text-muted-foreground">{fraseCentavos(r.extras)}</p>}
          <button disabled={!fecha} onClick={() => { onPronto(d); onFechar(); }} className="gradient-hero shadow-medium tap flex w-full items-center justify-center gap-2 rounded-2xl text-xl font-bold disabled:opacity-40">
            <Check size={26} strokeWidth={2.2} /> Pronto
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
