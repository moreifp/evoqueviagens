import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { User } from "lucide-react";
import type { Expense, Membro } from "@/lib/data";
import { categoria } from "@/lib/categorias";
import { fmtMoney } from "@/lib/format";
import { nomeCurto } from "@/lib/despesas";
import { iniciais } from "@/lib/pessoas";

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
      <Caixa className="shadow-soft grid min-h-16 items-center gap-2 rounded-2xl border-2 border-pessoal-border bg-pessoal p-3 grid-cols-[auto_minmax(0,1fr)_auto]">
        {mostrarData
          ? <span className="novo-some flex size-7 shrink-0 items-center justify-center rounded-lg bg-pessoal-chip text-pessoal-foreground"><User size={16} strokeWidth={2.2} /></span>
          : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pessoal-chip text-pessoal-foreground"><User size={26} strokeWidth={2.2} /></span>}
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {!mostrarData && <span className="novo-some flex size-8 shrink-0 items-center justify-center rounded-lg bg-pessoal-chip text-pessoal-foreground"><User size={18} strokeWidth={2.2} /></span>}
          <span className="min-w-0 flex-1">
            {mostrarData && <span className="num block text-xs font-semibold leading-tight text-muted-foreground">{data}</span>}
            <span className={`text-base font-bold text-foreground sm:text-lg ${mostrarData ? "line-clamp-2 break-words" : "block truncate"}`}>{d.descricao}</span>
            <span className="mt-0.5 inline-block rounded-md bg-pessoal-chip px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-pessoal-foreground">Pessoal · {eu && d.pessoal_de === eu ? "você" : nomeCurto(membros, d.pessoal_de)}</span>
          </span>
        </span>
        <span className="num shrink-0 text-right">
          <span className="block text-base font-bold text-pessoal-foreground">{fmtMoney(Number(d.valor_moeda_base), moedaBase)}</span>
          {mostrarData && <span className="block text-xs font-semibold text-muted-foreground">{iniciais(pag)}</span>}
        </span>
      </Caixa>
    );
  }
  return (
    <Caixa className="shadow-soft grid min-h-16 items-center gap-2 rounded-2xl border border-border bg-card p-3 grid-cols-[auto_minmax(0,1fr)_auto]">
      {mostrarData
        ? <span aria-hidden className="novo-some flex size-7 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: COR_CAT[c.id] ?? COR_CAT.outros }}><Icone size={16} strokeWidth={2.2} /></span>
        : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-teal"><Icone size={26} strokeWidth={2.2} /></span>}
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {!mostrarData && <span aria-hidden className="novo-some flex size-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: COR_CAT[c.id] ?? COR_CAT.outros }}><Icone size={18} strokeWidth={2.2} /></span>}
        <span className="min-w-0 flex-1">
          {mostrarData && <span className="num block text-xs font-semibold leading-tight text-muted-foreground">{data}</span>}
          <span className={`text-base font-bold text-foreground sm:text-lg ${mostrarData ? "line-clamp-2 break-words" : "block truncate"}`}>{d.descricao}</span>
          {!mostrarData && <span className="block truncate text-sm text-muted-foreground">{pag} pagou · {d.partes.length} {d.partes.length === 1 ? "pessoa" : "pessoas"}{d.taxa_provisoria ? " · taxa provisória" : ""}</span>}
          {minha && <span className="block text-sm font-bold text-teal">sua parte {fmtMoney(Number(minha.valor_moeda_base), moedaBase)}</span>}
        </span>
      </span>
      <span className="num shrink-0 text-right">
        <span className="block text-base font-bold text-foreground">{fmtMoney(Number(d.valor_moeda_base), moedaBase)}</span>
        {mostrarData && <span className="block text-xs font-semibold text-muted-foreground">{iniciais(pag)}</span>}
      </span>
    </Caixa>
  );
}
