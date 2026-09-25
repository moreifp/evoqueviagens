import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/MarketingPage";
import { marketingHead } from "@/lib/marketing-head";

export const Route = createFileRoute("/landing-preview")({
  head: () => marketingHead({
    title: "Prévia — Evoque Viagens",
    description: "Prévia revisável da landing pública do Evoque Viagens.",
    path: "/landing-preview",
    alternatePath: "/en",
    locale: "pt_BR",
    noindex: true,
    home: false,
  }),
  component: () => <MarketingPage page="home-pt" preview />,
});
