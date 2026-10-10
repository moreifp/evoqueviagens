import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Eye, User } from "lucide-react";
import { verDespesasPublicas } from "@/lib/despesasPublicas.functions";
import type { Expense } from "@/lib/data";
import { fmtMoney } from "@/lib/format";
import { acharMoeda } from "@/lib/moedas";
import { nomeCurto } from "@/lib/despesas";
import { LinhaDespesa } from "@/components/LinhaDespesa";
import { SaldosViagem } from "@/components/SaldosViagem";
import { resumoSaldos } from "@/lib/saldos";

export const Route = createFileRoute("/d/$token")({
  head: () => ({
    meta: [
      { title: "Despesas da viagem — Viagens Organizadas" },
      { name: "description", content: "Despesas, divisão e saldos da viagem, só para ver." },
      { property: "og:title", content: "Despesas da viagem — Viagens Organizadas" },
      { property: "og:description", content: "Despesas, divisão e saldos da viagem, só para ver." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Pagina,
});

const DIAS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const diaCab = (d: string) =>
  `${DIAS[new Date(`${d}T12:00:00Z`).getUTCDay()]} ${d.slice(8, 10)}/${d.slice(5, 7)}`;

function Pagina() {
  const { token } = Route.useParams();
  const ver = useServerFn(verDespesasPublicas);
  const q = useQuery({
    queryKey: ["despesas-publicas", token],
    queryFn: () => ver({ data: { token } }),
    refetchInterval: 60_000,
  });
  const [aba, setAba] = useState<"todas" | "pessoais">("todas");

  if (q.isLoading) return <div className="min-h-screen bg-background p-6 text-lg">Carregando…</div>;
  if (!q.data || !q.data.ok)
    return (
      <div className="min-h-screen bg-background p-6 text-lg font-semibold">
        Este link não vale mais. Peça um novo ao organizador.
      </div>
    );
  const { trip, despesas, acertos, membros } = q.data;
  const moeda = trip.moeda_base;
  const divididas = despesas.filter((d) => !d.pessoal);
  const pessoais = despesas.filter((d) => d.pessoal);
  const soma = (l: Expense[]) => l.reduce((s, d) => s + Number(d.valor_moeda_base), 0);
  const nPessoas =
    new Set(divididas.flatMap((d) => d.partes.map((p) => p.person_id))).size || membros.length;
  const dias = new Map<string, Expense[]>();
  for (const d of despesas) dias.set(d.data, [...(dias.get(d.data) ?? []), d]);
  const porPessoa = new Map<string, Expense[]>();
  for (const d of pessoais)
    porPessoa.set(d.pessoal_de ?? "", [...(porPessoa.get(d.pessoal_de ?? "") ?? []), d]);
  const { dividas } = resumoSaldos(despesas, acertos, membros);

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="px-4 pt-5">
        <h1 className="text-3xl">Despesas</h1>
        <p className="truncate text-base text-muted-foreground">
          {trip.nome} · {(acharMoeda(moeda)?.nome ?? moeda).toLowerCase()}
        </p>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-3">
        <p className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm font-bold text-foreground">
          <Eye size={18} strokeWidth={2.2} /> Só leitura
        </p>
        <SaldosViagem
          tripId=""
          tripNome={trip.nome}
          despesas={despesas}
          acertos={acertos}
          membros={membros}
          moeda={moeda}
          org
          semLink
        />

        <section className="rounded-3xl bg-navy p-5 text-primary-foreground shadow-medium">
          <p className="text-sm font-bold uppercase tracking-wide opacity-80">Total dividido</p>
          <p className="num mt-1 text-[42px] leading-none">{fmtMoney(soma(divididas), moeda)}</p>
          <p className="mt-3 text-base opacity-90">
            {nPessoas} pessoas · {divididas.length}{" "}
            {divididas.length === 1 ? "despesa" : "despesas"}
          </p>
          {dividas.length > 0 && (
            <ul className="mt-4 space-y-1 border-t border-primary-foreground/20 pt-3">
              <li className="text-sm font-bold uppercase tracking-wide opacity-80">
                Quem paga a quem
              </li>
              {dividas.map((d, i) => (
                <li key={i} className="flex justify-between gap-2 text-lg">
                  <span>
                    {nomeCurto(membros, d.de)} → {nomeCurto(membros, d.para)}
                  </span>
                  <span className="num">{fmtMoney(d.centavos / 100, moeda)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
          {(["todas", "pessoais"] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAba(a)}
              aria-pressed={aba === a}
              className={`min-h-12 rounded-xl text-base font-bold ${aba === a ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}
            >
              {a === "todas" ? "Todas" : `Pessoais (${pessoais.length})`}
            </button>
          ))}
        </div>

        {aba === "todas" &&
          (despesas.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-lg font-semibold">
              Nenhuma despesa ainda
            </p>
          ) : (
            [...dias.entries()].map(([dia, itens]) => (
              <section key={dia}>
                <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  {diaCab(dia)}
                </h2>
                <ul className="mt-2 space-y-2">
                  {itens.map((d) => (
                    <li key={d.id}>
                      <LinhaDespesa d={d} membros={membros} moedaBase={moeda} tripId="" semLink />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          ))}

        {aba === "pessoais" &&
          [...porPessoa.entries()].map(([pid, itens]) => (
            <section key={pid}>
              <h2 className="flex items-baseline justify-between text-base font-bold text-foreground">
                <span className="flex items-center gap-2">
                  <User size={20} strokeWidth={2.2} />
                  {nomeCurto(membros, pid)}
                </span>
                <span className="num text-lg text-pessoal-foreground">
                  {fmtMoney(soma(itens), moeda)}
                </span>
              </h2>
              <ul className="mt-2 space-y-2">
                {itens.map((d) => (
                  <li key={d.id}>
                    <LinhaDespesa d={d} membros={membros} moedaBase={moeda} tripId="" semLink />
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </main>
    </div>
  );
}
