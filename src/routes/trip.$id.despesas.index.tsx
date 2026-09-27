import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeftRight, ChevronLeft, Eye, Plus, User } from "lucide-react";
import { expensesQuery, membersQuery, tripQuery, type Expense } from "@/lib/data";
import { fmtMoney } from "@/lib/format";
import { acharMoeda } from "@/lib/moedas";
import { nomeCurto, useUid } from "@/lib/despesas";
import { LinhaDespesa } from "@/components/LinhaDespesa";

export const Route = createFileRoute("/trip/$id/despesas/")({
  head: () => ({
    meta: [
      { title: "Despesas da viagem — Evoque Viagens" },
      { name: "description", content: "Gastos da viagem divididos entre os participantes, na moeda da viagem." },
      { property: "og:title", content: "Despesas da viagem — Evoque Viagens" },
      { property: "og:description", content: "Gastos da viagem divididos entre os participantes, na moeda da viagem." },
    ],
  }),
  component: Lista,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-lg">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-lg">Sem despesas.</div>,
});

const DIAS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const diaCab = (d: string) => `${DIAS[new Date(`${d}T12:00:00Z`).getUTCDay()]} ${d.slice(8, 10)}/${d.slice(5, 7)}`;

function Lista() {
  const { id } = Route.useParams();
  const uid = useUid();
  const { data: trip } = useSuspenseQuery(tripQuery(id));
  const { data: despesas } = useSuspenseQuery(expensesQuery(id));
  const { data: membros } = useSuspenseQuery(membersQuery(id));
  const [aba, setAba] = useState<"todas" | "pessoais">("todas");
  const org = uid === trip.owner_id;
  const moeda = trip.moeda_base;
  const nomeMoeda = (acharMoeda(moeda)?.nome ?? moeda).toLowerCase();

  const divididas = despesas.filter((d) => !d.pessoal);
  const pessoais = despesas.filter((d) => d.pessoal);
  const soma = (l: Expense[]) => l.reduce((s, d) => s + Number(d.valor_moeda_base), 0);
  const nPessoas = new Set(divididas.flatMap((d) => d.partes.map((p) => p.person_id))).size || membros.length;

  const dias = new Map<string, Expense[]>();
  for (const d of despesas) dias.set(d.data, [...(dias.get(d.data) ?? []), d]);
  const porPessoa = new Map<string, Expense[]>();
  for (const d of pessoais) porPessoa.set(d.pessoal_de ?? "", [...(porPessoa.get(d.pessoal_de ?? "") ?? []), d]);

  return (
    <div className="min-h-screen bg-background pb-36">
      <header className="flex items-start gap-2 px-3 pt-3">
        <Link to="/trip/$id" params={{ id }} aria-label="Voltar" className="tap flex flex-col items-center justify-center rounded-xl text-foreground">
          <ChevronLeft size={28} strokeWidth={2.2} /><span className="text-xs font-semibold">Voltar</span>
        </Link>
        <div className="min-w-0 flex-1 pt-1">
          <h1 className="text-3xl">Despesas</h1>
          <p className="truncate text-base text-muted-foreground">{trip.nome} · {nomeMoeda}{org ? " · você organiza" : ""}</p>
        </div>
        <Link to="/despesas" className="tap flex flex-col items-center justify-center rounded-xl px-2 text-foreground">
          <ArrowLeftRight size={24} strokeWidth={2.2} /><span className="text-xs font-semibold">Viagem</span>
        </Link>
      </header>

      <main className="space-y-4 px-4 pt-3">
        {!org && uid !== undefined && (
          <p className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm font-bold text-foreground"><Eye size={18} strokeWidth={2.2} /> Só leitura</p>
        )}
        {/* Espaço reservado para os cartões de saldo (parte 2). */}

        <section className="rounded-3xl bg-navy p-5 text-primary-foreground shadow-medium">
          <p className="text-sm font-bold uppercase tracking-wide opacity-80">Total dividido</p>
          <p className="num mt-1 text-[42px] leading-none">{fmtMoney(soma(divididas), moeda)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-base opacity-90">{nPessoas} pessoas · {divididas.length} {divididas.length === 1 ? "despesa" : "despesas"}</span>
            {pessoais.length > 0 && <span className="rounded-full bg-pessoal-chip px-3 py-1 text-sm font-bold text-pessoal-foreground">+ {fmtMoney(soma(pessoais), moeda)} pessoais</span>}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
          {(["todas", "pessoais"] as const).map((a) => (
            <button key={a} onClick={() => setAba(a)} aria-pressed={aba === a} className={`min-h-12 rounded-xl text-base font-bold ${aba === a ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}>
              {a === "todas" ? "Todas" : `Pessoais (${pessoais.length})`}
            </button>
          ))}
        </div>

        {aba === "todas" && (
          despesas.length === 0
            ? <p className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-lg font-semibold">Nenhuma despesa ainda</p>
            : [...dias.entries()].map(([dia, itens]) => (
              <section key={dia}>
                <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{diaCab(dia)}</h2>
                <ul className="mt-2 space-y-2">{itens.map((d) => <li key={d.id}><LinhaDespesa d={d} membros={membros} moedaBase={moeda} tripId={id} /></li>)}</ul>
              </section>
            ))
        )}

        {aba === "pessoais" && (
          <>
            <section className="rounded-3xl border-2 border-pessoal-border bg-pessoal p-5">
              <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-pessoal-foreground"><User size={20} strokeWidth={2.2} /> Pessoais</p>
              <p className="num mt-1 text-[36px] leading-none text-pessoal-foreground">{fmtMoney(soma(pessoais), moeda)}</p>
              <p className="mt-2 text-base text-foreground">Não entram na divisão nem no saldo</p>
            </section>
            {[...porPessoa.entries()].map(([pid, itens]) => (
              <section key={pid}>
                <h2 className="flex items-baseline justify-between text-base font-bold text-foreground">
                  <span>{nomeCurto(membros, pid)}</span><span className="num text-lg text-pessoal-foreground">{fmtMoney(soma(itens), moeda)}</span>
                </h2>
                <ul className="mt-2 space-y-2">{itens.map((d) => <li key={d.id}><LinhaDespesa d={d} membros={membros} moedaBase={moeda} tripId={id} /></li>)}</ul>
              </section>
            ))}
          </>
        )}
      </main>

      {org && (
        <Link to="/trip/$id/despesas/nova" params={{ id }} search={{ editar: "", itemTipo: "", itemId: "", descricao: "", valor: "", moeda: "", data: "", categoria: "", pessoas: "", origemNome: "" }}
          className="fixed bottom-24 right-4 z-30 flex min-h-14 items-center gap-2 rounded-full bg-navy px-5 text-lg font-bold text-primary-foreground shadow-medium">
          <Plus size={26} strokeWidth={2.4} /> Despesa
        </Link>
      )}
    </div>
  );
}
