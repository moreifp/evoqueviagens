import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/MarketingPage";
import { marketingHead } from "@/lib/marketing-head";

export const Route = createFileRoute('/termos')({
  head: () => marketingHead({
    title: 'Termos de uso | Evoque Viagens',
    description: 'Condições de uso do Evoque Viagens, seu organizador de viagens.',
    path: '/termos',
    alternatePath: '/en/terms',
    locale: 'pt_BR',
    noindex: true,
    home: false,
  }),
  component: Page,
});

function Page() {
  return <MarketingPage page='terms-pt' />;
}
