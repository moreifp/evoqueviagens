import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Topo } from "@/components/Chrome";
import { FormBilhete } from "@/components/FormBilhete";
import { ticketsQuery } from "@/lib/data";

export const Route = createFileRoute("/trip/$id/bilhetes/novo")({
  validateSearch: (s: Record<string, unknown>): { editar?: string } => (typeof s.editar === "string" ? { editar: s.editar } : {}),
  head: () => ({
    meta: [
      { title: "Bilhete — Evoque Viagens" },
      { name: "description", content: "Cadastre ou edite voo, trem, ônibus ou transfer com passageiros e fuso automático." },
      { property: "og:title", content: "Bilhete — Evoque Viagens" },
      { property: "og:description", content: "Cadastre ou edite voo, trem, ônibus ou transfer com passageiros e fuso automático." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TelaBilhete,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-lg">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-lg">Bilhete não encontrado.</div>,
});

function TelaBilhete() {
  const { id } = Route.useParams();
  const { editar } = Route.useSearch();
  const { data: bilhetes } = useSuspenseQuery(ticketsQuery(id));
  const inicial = editar ? bilhetes.find((b) => b.id === editar) : undefined;
  if (editar && !inicial) return <p className="p-6 text-lg">Você não pode editar este bilhete.</p>;
  return (
    <>
      <Topo titulo={inicial ? "Editar bilhete" : "Novo bilhete"} voltarPara="/trip/$id/bilhetes" voltarParams={{ id }} />
      <FormBilhete key={editar ?? "novo"} tripId={id} inicial={inicial} />
    </>
  );
}
