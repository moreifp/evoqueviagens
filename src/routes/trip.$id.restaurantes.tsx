import { createFileRoute } from "@tanstack/react-router";
import { Topo } from "@/components/Chrome";
import { RestaurantsEmbed } from "@/components/RestaurantsEmbed";

export const Route = createFileRoute("/trip/$id/restaurantes")({
  head: () => ({
    meta: [
      { title: "Restaurantes — Viagens Organizadas" },
      { name: "description", content: "Restaurantes da viagem no Evoque Restaurants." },
      { property: "og:title", content: "Restaurantes" },
      { property: "og:description", content: "Restaurantes da viagem no Evoque Restaurants." },
    ],
  }),
  component: Restaurantes,
});

/**
 * O Evoque Restaurants embutido, dentro da viagem. As fotos salvas por aqui vão para a pasta
 * da viagem no Drive (<Viagem>/Restaurants/<restaurante>) quando a data cai nesta viagem.
 */
function Restaurantes() {
  const { id } = Route.useParams();
  return (
    <div className="fixed inset-x-0 top-0 bottom-[calc(72px+env(safe-area-inset-bottom))] flex flex-col bg-background">
      <Topo titulo="Restaurantes" voltarPara="/trip/$id" voltarParams={{ id }} />
      <RestaurantsEmbed className="relative min-h-0 flex-1" comTitulo={false} />
    </div>
  );
}
