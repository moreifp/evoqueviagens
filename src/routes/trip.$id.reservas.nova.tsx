import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Topo } from "@/components/Chrome";
import { FormReserva } from "@/components/FormReserva";
import { reservasQuery } from "@/lib/data";

export const Route = createFileRoute("/trip/$id/reservas/nova")({
  validateSearch: (s: Record<string, unknown>): { editar?: string } =>
    typeof s.editar === "string" ? { editar: s.editar } : {},
  head: () => ({
    meta: [
      { title: "Reserva — Evoque Viagens" },
      {
        name: "description",
        content: "Carro, passeio, restaurante ou outra reserva, com quem vai.",
      },
      { property: "og:title", content: "Reserva — Evoque Viagens" },
      {
        property: "og:description",
        content: "Carro, passeio, restaurante ou outra reserva, com quem vai.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TelaReserva,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-lg">
      {(error as Error).message}
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-lg">Reserva não encontrada.</div>,
});

function TelaReserva() {
  const { id } = Route.useParams();
  const { editar } = Route.useSearch();
  const { data: reservas } = useSuspenseQuery(reservasQuery(id));
  const inicial = editar ? reservas.find((r) => r.id === editar) : undefined;
  if (editar && !inicial) return <p className="p-6 text-lg">Você não pode editar esta reserva.</p>;
  return (
    <>
      <Topo
        titulo={inicial ? "Editar reserva" : "Nova reserva"}
        voltarPara="/trip/$id/reservas"
        voltarParams={{ id }}
      />
      <FormReserva key={editar ?? "novo"} tripId={id} inicial={inicial} />
    </>
  );
}
