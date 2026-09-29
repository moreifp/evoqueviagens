import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Topo } from "@/components/Chrome";
import { FormHotel } from "@/components/FormHotel";
import { lodgingsQuery } from "@/lib/data";

export const Route = createFileRoute("/trip/$id/hospedagem/nova")({
  validateSearch: (s: Record<string, unknown>): { editar?: string } =>
    typeof s.editar === "string" ? { editar: s.editar } : {},
  head: () => ({
    meta: [
      { title: "Hospedagem — Evoque Viagens" },
      {
        name: "description",
        content: "Cadastre ou edite hotel com quartos, hóspedes, entrada e saída.",
      },
      { property: "og:title", content: "Hospedagem — Evoque Viagens" },
      {
        property: "og:description",
        content: "Cadastre ou edite hotel com quartos, hóspedes, entrada e saída.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TelaHotel,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-lg">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-lg">Hospedagem não encontrada.</div>,
});

function TelaHotel() {
  const { id } = Route.useParams();
  const { editar } = Route.useSearch();
  const { data: hoteis } = useSuspenseQuery(lodgingsQuery(id));
  const inicial = editar ? hoteis.find((h) => h.id === editar) : undefined;
  if (editar && !inicial)
    return <p className="p-6 text-lg">Você não pode editar esta hospedagem.</p>;
  return (
    <>
      <Topo
        titulo={inicial ? "Editar hospedagem" : "Nova hospedagem"}
        voltarPara="/trip/$id/hospedagem"
        voltarParams={{ id }}
      />
      <FormHotel key={editar ?? "novo"} tripId={id} inicial={inicial} />
    </>
  );
}
