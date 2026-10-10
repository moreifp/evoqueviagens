import { createFileRoute } from "@tanstack/react-router";
import { RestaurantsEmbed } from "@/components/RestaurantsEmbed";

export const Route = createFileRoute("/restaurantes")({
  head: () => ({
    meta: [
      { title: "Restaurantes — Evoque Viagens" },
      { name: "description", content: "Seus restaurantes no Evoque, dentro do app de viagens." },
      { property: "og:title", content: "Restaurantes — Evoque Viagens" },
      {
        property: "og:description",
        content: "Seus restaurantes no Evoque, dentro do app de viagens.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <RestaurantsEmbed />,
});

