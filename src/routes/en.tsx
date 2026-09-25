import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/MarketingPage";
import { marketingHead } from "@/lib/marketing-head";

export const Route = createFileRoute('/en')({
  head: () => marketingHead({
    title: 'Evoque Travels | Your whole trip. Even offline.',
    description: 'Documents, flights, hotels and bookings in one place. Review the details and keep your saved trip at hand, even offline.',
    path: '/en',
    alternatePath: '/',
    locale: 'en_US',
    noindex: true,
    home: true,
  }),
  component: Page,
});

function Page() {
  return <MarketingPage page='home-en' />;
}
