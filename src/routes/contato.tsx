import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/MarketingPage";
import { marketingHead } from "@/lib/marketing-head";

export const Route = createFileRoute('/contato')({
  head: () => marketingHead({
    title: 'Vamos conversar. | Evoque Viagens',
    description: 'Fale com o Evoque Viagens pelo e-mail contato@evoque.global.',
    path: '/contato',
    alternatePath: '/en/contact',
    locale: 'pt_BR',
    noindex: true,
    home: false,
  }),
  component: Page,
});

function Page() {
  return <MarketingPage page='contact-pt' />;
}
