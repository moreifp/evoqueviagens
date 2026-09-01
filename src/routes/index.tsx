import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus, MapPin, Users } from "lucide-react";
import { tripsQuery } from "@/lib/data";
import { dataBRCurta, diasAte, mesAno } from "@/lib/format";
import { Avatar } from "@/components/Chrome";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Evoque Viagens — suas viagens em um lugar só" },
      {
        name: "description",
        content:
          "Bilhetes, hospedagem, gastos e conferência de datas da sua viagem, prontos para abrir no aeroporto.",
      },
      { property: "og:title", content: "Evoque Viagens" },
      {
        property: "og:description",
        content: "A viagem inteira em um lugar só: bilhetes, hotel, gastos e conferência.",
      },
    ],
  }),
  component: MinhasViagens,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-lg text-foreground">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-lg">Nada aqui.</div>,
});

function MinhasViagens() {
  const { data: viagens } = useSuspenseQuery(tripsQuery());

  const ativas = viagens.filter((v) => !v.arquivada_em);
  const arquivadas = viagens.filter((v) => v.arquivada_em);
  const hoje = new Date().toISOString().slice(0, 10);
  const atual =
    ativas.find((v) => v.data_inicio <= hoje && v.data_fim >= hoje) ??
    ativas.find((v) => v.data_inicio > hoje) ??
    ativas[0];
  const outras = ativas.filter((v) => v.id !== atual?.id);

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="flex items-center gap-2 px-4 py-3">
        <h1 className="flex-1 text-3xl">Minhas viagens</h1>
        <Avatar />
      </header>

      <main className="px-4">
        {atual ? (
          <CardGrande id={atual.id} nome={atual.nome} destino={atual.destino} inicio={atual.data_inicio} fim={atual.data_fim} />
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center">
            <p className="text-lg font-semibold text-foreground">Nenhuma viagem ainda</p>
          </div>
        )}

        {outras.length > 0 && (
          <section className="mt-6 space-y-3">
            {outras.map((v) => (
              <Link
                key={v.id}
                to="/trip/$id"
                params={{ id: v.id }}
                className="shadow-soft tap flex items-center gap-3 rounded-2xl border border-border bg-card px-4"
              >
                <MapPin size={28} strokeWidth={2.2} className="text-accent" />
                <span className="flex-1 truncate text-lg font-bold text-foreground">{v.nome}</span>
                <span className="text-base font-semibold text-muted-foreground">
                  {dataBRCurta(v.data_inicio)}
                </span>
              </Link>
            ))}
          </section>
        )}

        {arquivadas.length > 0 && (
          <section className="mt-8">
            <h2 className="text-base font-bold uppercase tracking-wide text-muted-foreground">
              Arquivadas
            </h2>
            <ul className="mt-2 divide-y divide-border">
              {arquivadas.map((v) => (
                <li key={v.id}>
                  <Link
                    to="/trip/$id"
                    params={{ id: v.id }}
                    className="tap flex items-center justify-between gap-3"
                  >
                    <span className="truncate text-base font-semibold text-foreground">{v.nome}</span>
                    <span className="text-sm text-muted-foreground">{mesAno(v.data_inicio)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Link
          to="/nova-viagem"
          className="gradient-hero shadow-medium tap flex w-full items-center justify-center gap-3 rounded-2xl text-xl font-bold"
        >
          <Plus size={28} strokeWidth={2.2} />
          Nova viagem
        </Link>
      </div>
    </div>
  );
}

function CardGrande({
  id,
  nome,
  destino,
  inicio,
  fim,
}: {
  id: string;
  nome: string;
  destino: string | null;
  inicio: string;
  fim: string;
}) {
  const dias = diasAte(inicio);
  const selo =
    dias > 0 ? `Começa em ${dias} ${dias === 1 ? "dia" : "dias"}` : dias === 0 ? "Começa hoje" : "Em andamento";
  return (
    <Link
      to="/trip/$id"
      params={{ id }}
      className="gradient-hero shadow-medium block rounded-3xl p-6"
    >
      <span className="inline-flex items-center rounded-full bg-black/25 px-4 py-2 text-sm font-bold">
        {selo}
      </span>
      <h2 className="mt-4 text-xl leading-tight">{nome}</h2>
      <p className="mt-2 text-lg font-semibold opacity-95">
        {dataBRCurta(inicio)} — {dataBRCurta(fim)}
      </p>
      <p className="mt-1 flex items-center gap-2 text-base opacity-90">
        <Users size={22} strokeWidth={2.2} />
        {destino ?? "Destino a definir"}
      </p>
    </Link>
  );
}
