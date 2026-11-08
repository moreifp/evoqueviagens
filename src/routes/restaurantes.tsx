import { createFileRoute } from "@tanstack/react-router";
import { RestaurantsEmbed } from "@/components/RestaurantsEmbed";
import { viagemAberta } from "@/lib/viagem-aberta";

export const Route = createFileRoute("/restaurantes")({
  head: () => ({
    meta: [
      { title: "Restaurantes — Viagens Organizadas" },
      { name: "description", content: "Seus restaurantes no Viagens Organizadas, dentro do app de viagens." },
      { property: "og:title", content: "Restaurantes — Viagens Organizadas" },
      {
        property: "og:description",
        content: "Seus restaurantes no Viagens Organizadas, dentro do app de viagens.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // Aberto pela aba de baixo: segue a viagem em que a pessoa está; sem viagem, vale a data.
  component: () => <RestaurantsEmbed tripId={viagemAberta()} />,
});

