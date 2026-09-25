import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/MarketingPage";
import { marketingHead } from "@/lib/marketing-head";

export const Route = createFileRoute('/en/terms')({
  head: () => marketingHead({
    title: 'Terms of use | Evoque Travels',
    description: 'Terms for using Evoque Travels, your travel organizer.',
    path: '/en/terms',
    alternatePath: '/termos',
    locale: 'en_US',
    noindex: true,
    home: false,
  }),
  component: Page,
});

function Page() {
  return <MarketingPage page='terms-en' />;
}
