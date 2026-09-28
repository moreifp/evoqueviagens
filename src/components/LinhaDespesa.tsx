import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { User } from "lucide-react";
import type { Expense, Membro } from "@/lib/data";
import { categoria } from "@/lib/categorias";
import { fmtMoney } from "@/lib/format";
import { nomeCurto } from "@/lib/despesas";

export function LinhaDespesa({ d, membros, moedaBase, tripId, eu, semLink }: { d: Expense; membros: Membro[]; moedaBase: string; tripId: string; eu?: string; semLink?: boolean }) {
  const minha = eu ? d.partes.find((p) => p.person_id === eu) : undefined;
  const c = categoria(d.categoria);
  const Icone = c.Icone;
  const pag = d.pagadores.length > 1 ? `${d.pagadores.length} pagaram` : `${nomeCurto(membros, d.pagadores[0]?.person_id ?? d.pago_por)} pagou`;
  const Caixa = ({ className, children }: { className: string; children: ReactNode }) =>
    semLink ? <div className={className}>{children}</div> : <Link to="/trip/$id/despesas/$eid" params={{ id: tripId, eid: d.id }} className={className}>{children}</Link>;
  if (d.pessoal) {
    return (
      <Caixa className="flex min-h-16 items-center gap-3 rounded-2xl border-2 border-pessoal-border bg-pessoal p-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pessoal-chip text-pessoal-foreground"><User size={26} strokeWidth={2.2} /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-bold text-foreground">{d.descricao}</span>
          <span className="mt-0.5 inline-block rounded-md bg-pessoal-chip px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-pessoal-foreground">Pessoal · {eu && d.pessoal_de === eu ? "você" : nomeCurto(membros, d.pessoal_de)}</span>
        </span>
        <span className="num shrink-0 text-xl text-pessoal-foreground">{fmtMoney(Number(d.valor_moeda_base), moedaBase)}</span>
      </Caixa>
    );
  }
  return (
    <Caixa className="shadow-soft flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-teal"><Icone size={26} strokeWidth={2.2} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-bold text-foreground">{d.descricao}</span>
        <span className="block truncate text-sm text-muted-foreground">{pag} · {d.partes.length} {d.partes.length === 1 ? "pessoa" : "pessoas"}{d.taxa_provisoria ? " · taxa provisória" : ""}</span>
        {minha && <span className="block text-sm font-bold text-teal">sua parte {fmtMoney(Number(minha.valor_moeda_base), moedaBase)}</span>}
      </span>
      <span className="num shrink-0 text-xl text-foreground">{fmtMoney(Number(d.valor_moeda_base), moedaBase)}</span>
    </Caixa>
  );
}
