import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/MarketingPage";
import { marketingHead } from "@/lib/marketing-head";

export const Route = createFileRoute("/contato")({
  head: () =>
    marketingHead({
      title: "Vamos conversar. | Viagens Organizadas",
      description: "Fale com o Viagens Organizadas pelo e-mail contato@evoque.global.",
      path: "/contato",
      alternatePath: "/en/contact",
      locale: "pt_BR",
      noindex: true,
      home: false,
    }),
  component: Page,
});

function Page() {
  return <MarketingPage page="contact-pt" />;
}
