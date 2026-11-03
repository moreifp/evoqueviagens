import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/MarketingPage";
import { marketingHead } from "@/lib/marketing-head";

export const Route = createFileRoute("/conectar-assistente")({
  head: () =>
    marketingHead({
      title: "Sua viagem, na conversa. | Viagens Organizadas",
      description:
        "Conecte Claude ou ChatGPT ao Viagens Organizadas para propor reservas e revisar os dados da viagem.",
      path: "/conectar-assistente",
      alternatePath: "/en/connect-assistant",
      locale: "pt_BR",
      noindex: true,
      home: false,
    }),
  component: Page,
});

function Page() {
  return <MarketingPage page="connect-pt" />;
}
