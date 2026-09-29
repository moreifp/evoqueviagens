import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/MarketingPage";
import { marketingHead } from "@/lib/marketing-head";

export const Route = createFileRoute("/privacidade")({
  head: () =>
    marketingHead({
      title: "Política de privacidade | Evoque Viagens",
      description:
        "Conheça como o Evoque Viagens trata seus dados e suas escolhas de compartilhamento.",
      path: "/privacidade",
      alternatePath: "/en/privacy",
      locale: "pt_BR",
      noindex: true,
      home: false,
    }),
  component: Page,
});

function Page() {
  return <MarketingPage page="privacy-pt" />;
}
