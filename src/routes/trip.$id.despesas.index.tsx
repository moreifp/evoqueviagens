import { resumoSaldos } from "@/lib/saldos";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  HandCoins,
  Eye,
  FileSpreadsheet,
  FileText,
  Plus,
  User,
} from "lucide-react";
import { expensesQuery, settlementsQuery, membersQuery, tripQuery, type Expense } from "@/lib/data";
import { fmtMoney } from "@/lib/format";
import { acharMoeda } from "@/lib/moedas";
import { nomeCurto, useUid } from "@/lib/despesas";
import { LinhaDespesa } from "@/components/LinhaDespesa";
import { baixarExcel, baixarPdf, montarTabela } from "@/lib/exportarDespesas";
import { SaldosViagem } from "@/components/SaldosViagem";
import { LinkDespesas } from "@/components/LinkDespesas";

export const Route = createFileRoute("/trip/$id/despesas/")({
  head: () => ({
    meta: [
      { title: "Despesas da viagem — Evoque Viagens" },
      {
        name: "description",
        content: "Gastos da viagem divididos entre os participantes, na moeda da viagem.",
      },
      { property: "og:title", content: "Despesas da viagem — Evoque Viagens" },
      {
        property: "og:description",
        content: "Gastos da viagem divididos entre os participantes, na moeda da viagem.",
      },
    ],
  }),
  component: Lista,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-lg">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-lg">Sem despesas.</div>,
});

function Lista() {
  const { id } = Route.useParams();
  const uid = useUid();
  const { data: trip } = useSuspenseQuery(tripQuery(id));
  const { data: despesas } = useSuspenseQuery(expensesQuery(id));
  const { data: membros } = useSuspenseQuery(membersQuery(id));
  const { data: acertos } = useSuspenseQuery(settlementsQuery(id));
  const [aba, setAba] = useState<"todas" | "pessoais">("todas");
  const [mostrarDivisao, setMostrarDivisao] = useState(false);
  const [mostrarLista, setMostrarLista] = useState(false);
  const org = uid === trip.owner_id;
  const moeda = trip.moeda_base;
  const nomeMoeda = (acharMoeda(moeda)?.nome ?? moeda).toLowerCase();

  const { saldos, eu } = resumoSaldos(despesas, acertos, membros);
  const meuSaldo = eu ? (saldos[eu] ?? 0) : 0;
  const divididas = despesas.filter((d) => !d.pessoal);
  const pessoais = despesas.filter((d) => d.pessoal);
  const soma = (l: Expense[]) => l.reduce((s, d) => s + Number(d.valor_moeda_base), 0);
  const nPessoas =
    new Set(divididas.flatMap((d) => d.partes.map((p) => p.person_id))).size || membros.length;

  const porPessoa = new Map<string, Expense[]>();
  for (const d of pessoais)
    porPessoa.set(d.pessoal_de ?? "", [...(porPessoa.get(d.pessoal_de ?? "") ?? []), d]);

  return (
    <div className="min-h-screen bg-background pb-36">
      <header className="flex items-start gap-2 px-3 pt-3">
        <Link
          to="/trip/$id"
          params={{ id }}
          aria-label="Voltar"
          className="tap flex flex-col items-center justify-center rounded-xl text-foreground"
        >
          <ChevronLeft size={28} strokeWidth={2.2} />
          <span className="text-xs font-semibold">Voltar</span>
        </Link>
        <div className="min-w-0 flex-1 pt-1">
          <h1 className="text-3xl">Despesas</h1>
          <p className="truncate text-base text-muted-foreground">
            {trip.nome} · {nomeMoeda}
            {org ? " · você organiza" : ""}
          </p>
        </div>
        <Link
          to="/despesas"
          search={{ escolher: true }}
          className="tap flex flex-col items-center justify-center rounded-xl px-2 text-foreground"
        >
          <ArrowLeftRight size={24} strokeWidth={2.2} />
          <span className="text-xs font-semibold">Viagem</span>
        </Link>
      </header>

      <main className="space-y-4 px-4 pt-3">
        {org && (
          <Link
            to="/trip/$id/despesas/nova"
            params={{ id }}
            search={{
              editar: "",
              itemTipo: "",
              itemId: "",
              descricao: "",
              valor: "",
              moeda: "",
              data: "",
              categoria: "",
              pessoas: "",
              origemNome: "",
            }}
            className="tap flex w-full items-center justify-center gap-2 novo-botao rounded-2xl bg-desp px-5 text-lg font-bold text-white shadow-medium"
          >
            <Plus size={26} strokeWidth={2.4} /> Nova despesa
          </Link>
        )}
        {!org && uid !== undefined && (
          <p className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm font-bold text-foreground">
            <Eye size={18} strokeWidth={2.2} /> Só leitura
          </p>
        )}
        <section className="overflow-hidden rounded-2xl border-2 border-border bg-card">
          <button
            type="button"
            onClick={() => setMostrarLista((v) => !v)}
            aria-expanded={mostrarLista}
            aria-controls="lista-despesas"
            className="tap flex w-full items-center justify-between gap-3 px-4 text-left"
          >
            <span className="text-lg font-bold text-foreground">Despesas · {despesas.length}</span>
            {mostrarLista ? (
              <ChevronUp className="shrink-0" size={26} strokeWidth={2.2} />
            ) : (
              <ChevronDown className="shrink-0" size={26} strokeWidth={2.2} />
            )}
          </button>
          {mostrarLista && (
            <div id="lista-despesas" className="space-y-3 border-t border-border p-3">
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-sm">
                {(["todas", "pessoais"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAba(a)}
                    aria-pressed={aba === a}
                    className={`min-h-11 rounded-lg text-sm font-bold ${aba === a ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}
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
                  <section aria-label="Despesas da viagem">
                    <ul className="space-y-2">
                      {[...despesas]
                        .sort((a, b) => b.data.localeCompare(a.data))
                        .map((d) => (
                          <li key={d.id}>
                            <LinhaDespesa
                              d={d}
                              mostrarData
                              eu={
                                org
                                  ? undefined
                                  : membros.find((m) => m.meu && m.kind === "self")?.person_id
                              }
                              membros={membros}
                              moedaBase={moeda}
                              tripId={id}
                            />
                          </li>
                        ))}
                    </ul>
                  </section>
                ))}

              {aba === "pessoais" && (
                <>
                  <section className="rounded-3xl border-2 border-pessoal-border bg-pessoal p-5">
                    <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-pessoal-foreground">
                      <User size={20} strokeWidth={2.2} /> Pessoais
                    </p>
                    <p className="num mt-1 text-[36px] leading-none text-pessoal-foreground">
                      {fmtMoney(soma(pessoais), moeda)}
                    </p>
                    <p className="mt-2 text-base text-foreground">
                      Não entram na divisão nem no saldo
                    </p>
                  </section>
                  {[...porPessoa.entries()].map(([pid, itens]) => (
                    <section key={pid}>
                      <h2 className="flex items-baseline justify-between text-base font-bold text-foreground">
                        <span>{nomeCurto(membros, pid)}</span>
                        <span className="num text-lg text-pessoal-foreground">
                          {fmtMoney(soma(itens), moeda)}
                        </span>
                      </h2>
                      <ul className="mt-2 space-y-2">
                        {itens.map((d) => (
                          <li key={d.id}>
                            <LinhaDespesa
                              d={d}
                              mostrarData
                              eu={
                                org
                                  ? undefined
                                  : membros.find((m) => m.meu && m.kind === "self")?.person_id
                              }
                              membros={membros}
                              moedaBase={moeda}
                              tripId={id}
                            />
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </>
              )}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border-2 border-border bg-card">
          <button
            type="button"
            onClick={() => setMostrarDivisao((v) => !v)}
            aria-expanded={mostrarDivisao}
            aria-controls="divisao-despesas"
            className="tap grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 text-left"
          >
            <span className="min-w-0">
              <span className="block text-lg font-bold text-foreground">Divisão</span>
              {eu ? (
                <span
                  className={`block truncate text-base font-bold ${meuSaldo > 0 ? "text-recebe" : meuSaldo < 0 ? "text-deve" : "text-emdia"}`}
                >
                  {meuSaldo > 0
                    ? `você recebe ${fmtMoney(meuSaldo / 100, moeda)}`
                    : meuSaldo < 0
                      ? `você deve ${fmtMoney(-meuSaldo / 100, moeda)}`
                      : "em dia"}
                </span>
              ) : (
                <span className="block truncate text-sm text-muted-foreground">
                  Saldos e pagamentos entre as pessoas
                </span>
              )}
            </span>
            {mostrarDivisao ? (
              <ChevronUp className="shrink-0" size={26} strokeWidth={2.2} />
            ) : (
              <ChevronDown className="shrink-0" size={26} strokeWidth={2.2} />
            )}
          </button>
          {mostrarDivisao && (
            <div id="divisao-despesas" className="space-y-4 border-t border-border p-3">
              <h2 className="text-lg font-bold text-foreground">Quem deve e quem recebe</h2>
              <section className="rounded-2xl bg-navy p-4 text-primary-foreground">
                <p className="text-sm font-bold uppercase opacity-80">Total dividido</p>
                <p className="num mt-1 text-[36px] leading-none">
                  {fmtMoney(soma(divididas), moeda)}
                </p>
                <p className="mt-2 text-base opacity-90">
                  {nPessoas} pessoas · {divididas.length}{" "}
                  {divididas.length === 1 ? "despesa" : "despesas"}
                </p>
                {acertos.length + divididas.length > 0 && (
                  <Link
                    to="/trip/$id/despesas/acertar"
                    params={{ id }}
                    className="tap mt-3 flex items-center justify-center gap-2 rounded-xl bg-primary-foreground text-base font-bold text-navy"
                  >
                    <HandCoins size={22} strokeWidth={2.2} />{" "}
                    {org ? "Simplificar e acertar" : "Quem paga a quem"}
                  </Link>
                )}
              </section>
              <SaldosViagem
                tripId={id}
                tripNome={trip.nome}
                despesas={despesas}
                acertos={acertos}
                membros={membros}
                moeda={moeda}
                org={org}
              />
            </div>
          )}
        </section>

        {org && <LinkDespesas tripId={id} tripNome={trip.nome} />}

        {despesas.length + acertos.length > 0 && (
          <div className="grid grid-cols-2 gap-2" aria-label="Criar relatório">
            <button
              onClick={() =>
                void baixarExcel(montarTabela(trip.nome, despesas, acertos, membros, moeda))
              }
              className="tap flex items-center justify-center gap-2 rounded-2xl border-2 border-primary text-base font-bold text-foreground"
            >
              <FileSpreadsheet size={24} strokeWidth={2.2} /> Excel
            </button>
            <button
              onClick={() =>
                void baixarPdf(montarTabela(trip.nome, despesas, acertos, membros, moeda))
              }
              className="tap flex items-center justify-center gap-2 rounded-2xl border-2 border-primary text-base font-bold text-foreground"
            >
              <FileText size={24} strokeWidth={2.2} /> PDF
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
