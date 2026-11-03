import { createFileRoute } from "@tanstack/react-router";
import { RestaurantsEmbed } from "@/components/RestaurantsEmbed";

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
  component: () => <RestaurantsEmbed />,
});

