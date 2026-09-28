import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ChevronRight, Wallet } from "lucide-react";
import { tripsQuery } from "@/lib/data";
import { dataBRCurta } from "@/lib/format";

export const Route = createFileRoute("/despesas")({
  validateSearch: (s: Record<string, unknown>) => ({ escolher: s.escolher === true || s.escolher === "true" }),
  head: () => ({
    meta: [
      { title: "Despesas — Evoque Viagens" },
      { name: "description", content: "Escolha a viagem para ver e lançar despesas." },
      { property: "og:title", content: "Despesas — Evoque Viagens" },
      { property: "og:description", content: "Escolha a viagem para ver e lançar despesas." },
    ],
  }),
  component: Despesas,
});

/** Viagem padrão: a que está acontecendo; senão a próxima; senão a mais recente. */
function viagemPadrao(ativas: { id: string; data_inicio: string; data_fim: string }[]) {
  const hoje = new Date().toLocaleDateString("en-CA");
  return (
    ativas.find((t) => t.data_inicio <= hoje && t.data_fim >= hoje) ??
    ativas.find((t) => t.data_inicio > hoje) ??
    [...ativas].sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))[0]
  );
}

function Despesas() {
  const navigate = useNavigate();
  const { escolher } = Route.useSearch();
  const { data: viagens = [], isLoading } = useQuery(tripsQuery());
  const ativas = viagens.filter((t) => !t.arquivada_em);
  const padrao = escolher ? undefined : viagemPadrao(ativas);

  useEffect(() => {
    if (padrao) navigate({ to: "/trip/$id/despesas", params: { id: padrao.id }, replace: true });
  }, [padrao, navigate]);

  if (isLoading || padrao) return <p className="p-6 text-lg">Abrindo as despesas…</p>;

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="px-4 py-3">
        <h1 className="text-3xl">Despesas</h1>
        <p className="text-base text-muted-foreground">Escolha a viagem</p>
      </header>
      <ul className="space-y-2 px-4">
        {ativas.map((t) => (
          <li key={t.id}>
            <Link to="/trip/$id/despesas" params={{ id: t.id }} className="shadow-soft flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-desp-soft text-desp"><Wallet size={26} strokeWidth={2.2} /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-lg font-bold">{t.nome}</span><span className="block text-sm text-muted-foreground">{dataBRCurta(t.data_inicio)} a {dataBRCurta(t.data_fim)} · {t.moeda_base}</span></span>
              <ChevronRight size={26} strokeWidth={2.2} />
            </Link>
          </li>
        ))}
        {ativas.length === 0 && <p className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-lg font-semibold">Nenhuma viagem ainda</p>}
      </ul>
    </div>
  );
}
