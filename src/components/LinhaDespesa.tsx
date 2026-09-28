import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { User } from "lucide-react";
import type { Expense, Membro } from "@/lib/data";
import { categoria } from "@/lib/categorias";
import { fmtMoney } from "@/lib/format";
import { nomeCurto } from "@/lib/despesas";

// Cor da categoria (contraste branco ≥ 4,5:1 em todas).
const COR_CAT: Record<string, string> = { comida: "#8e3d6b", transporte: "#2f6da8", hospedagem: "#b05a2f", passeio: "#5d6b2e", compras: "#97701a", outros: "#3d5064" };

export function LinhaDespesa({ d, membros, moedaBase, tripId, eu, semLink, mostrarData = false }: { d: Expense; membros: Membro[]; moedaBase: string; tripId: string; eu?: string; semLink?: boolean; mostrarData?: boolean }) {
  const minha = eu ? d.partes.find((p) => p.person_id === eu) : undefined;
  const c = categoria(d.categoria);
  const Icone = c.Icone;
  const pag = d.pagadores.length > 1 ? `${d.pagadores.length} pagaram` : nomeCurto(membros, d.pagadores[0]?.person_id ?? d.pago_por);
  const data = `${d.data.slice(8, 10)}/${d.data.slice(5, 7)}`;
  const Caixa = ({ className, children }: { className: string; children: ReactNode }) =>
    semLink ? <div className={className}>{children}</div> : <Link to="/trip/$id/despesas/$eid" params={{ id: tripId, eid: d.id }} className={className}>{children}</Link>;
  if (d.pessoal) {
    return (
      <Caixa className={`grid min-h-16 items-center gap-2 rounded-2xl border-2 border-pessoal-border bg-pessoal p-3 ${mostrarData ? "grid-cols-[3rem_minmax(0,1fr)_auto_4.5rem]" : "grid-cols-[auto_minmax(0,1fr)_auto]"}`}>
        {mostrarData ? <span className="num text-sm font-bold text-muted-foreground">{data}</span> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pessoal-chip text-pessoal-foreground"><User size={26} strokeWidth={2.2} /></span>}
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {mostrarData && <span className="novo-some flex size-8 shrink-0 items-center justify-center rounded-lg bg-pessoal-chip text-pessoal-foreground"><User size={18} strokeWidth={2.2} /></span>}
          <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-bold text-foreground">{d.descricao}</span>
          <span className="mt-0.5 inline-block rounded-md bg-pessoal-chip px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-pessoal-foreground">Pessoal · {eu && d.pessoal_de === eu ? "você" : nomeCurto(membros, d.pessoal_de)}</span>
        </span>
        <span className="num shrink-0 text-base font-bold text-pessoal-foreground">{fmtMoney(Number(d.valor_moeda_base), moedaBase)}</span>
        {mostrarData && <span className="truncate text-right text-sm font-semibold text-muted-foreground">{pag}</span>}
      </Caixa>
    );
  }
  return (
    <Caixa className={`shadow-soft grid min-h-16 items-center gap-2 rounded-2xl border border-border bg-card p-3 ${mostrarData ? "grid-cols-[3rem_minmax(0,1fr)_auto_4.5rem]" : "grid-cols-[auto_minmax(0,1fr)_auto]"}`}>
      {mostrarData ? <span className="num text-sm font-bold text-muted-foreground">{data}</span> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-teal"><Icone size={26} strokeWidth={2.2} /></span>}
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {mostrarData && <span aria-hidden className="novo-some flex size-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: COR_CAT[c.id] ?? COR_CAT.outros }}><Icone size={18} strokeWidth={2.2} /></span>}
        <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-bold text-foreground">{d.descricao}</span>
        {!mostrarData && <span className="block truncate text-sm text-muted-foreground">{pag} pagou · {d.partes.length} {d.partes.length === 1 ? "pessoa" : "pessoas"}{d.taxa_provisoria ? " · taxa provisória" : ""}</span>}
        {minha && <span className="block text-sm font-bold text-teal">sua parte {fmtMoney(Number(minha.valor_moeda_base), moedaBase)}</span>}
        </span>
      </span>
      <span className="num shrink-0 text-base font-bold text-foreground">{fmtMoney(Number(d.valor_moeda_base), moedaBase)}</span>
      {mostrarData && <span className="truncate text-right text-sm font-semibold text-muted-foreground">{pag}</span>}
    </Caixa>
  );
}
