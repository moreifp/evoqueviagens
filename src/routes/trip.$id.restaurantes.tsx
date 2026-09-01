import { createFileRoute } from "@tanstack/react-router";
import { UtensilsCrossed } from "lucide-react";
import { Topo } from "@/components/Chrome";

export const Route = createFileRoute("/trip/$id/restaurantes")({
  head: () => ({
    meta: [
      { title: "Restaurantes — Evoque Viagens" },
      { name: "description", content: "Lugares para comer na viagem, em breve." },
      { property: "og:title", content: "Restaurantes" },
      { property: "og:description", content: "Lugares para comer na viagem, em breve." },
    ],
  }),
  component: Restaurantes,
});

function Restaurantes() {
  const { id } = Route.useParams();
  return (
    <>
      <Topo titulo="Restaurantes" voltarPara="/trip/$id" voltarParams={{ id }} />
      <main className="flex flex-col items-center justify-center gap-4 px-8 pt-24 text-center">
        <UtensilsCrossed size={56} strokeWidth={2.2} className="text-accent" />
        <p className="text-2xl text-foreground">Chega na Entrega 4</p>
      </main>
    </>
  );
}
