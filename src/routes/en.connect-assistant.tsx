import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/MarketingPage";
import { marketingHead } from "@/lib/marketing-head";

export const Route = createFileRoute("/en/connect-assistant")({
  head: () =>
    marketingHead({
      title: "Your trip, in the conversation. | Viagens Organizadas",
      description:
        "Connect Claude or ChatGPT to Viagens Organizadas to propose bookings and review trip details.",
      path: "/en/connect-assistant",
      alternatePath: "/conectar-assistente",
      locale: "en_US",
      noindex: true,
      home: false,
    }),
  component: Page,
});

function Page() {
  return <MarketingPage page="connect-en" />;
}
