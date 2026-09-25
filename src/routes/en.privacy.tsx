import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/MarketingPage";
import { marketingHead } from "@/lib/marketing-head";

export const Route = createFileRoute('/en/privacy')({
  head: () => marketingHead({
    title: 'Privacy policy | Evoque Travels',
    description: 'Learn how Evoque Travels handles your data and sharing choices.',
    path: '/en/privacy',
    alternatePath: '/privacidade',
    locale: 'en_US',
    noindex: true,
    home: false,
  }),
  component: Page,
});

function Page() {
  return <MarketingPage page='privacy-en' />;
}
