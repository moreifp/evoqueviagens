import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/MarketingPage";
import { marketingHead } from "@/lib/marketing-head";

export const Route = createFileRoute("/conectar-assistente")({
  head: () =>
    marketingHead({
      title: "Sua viagem, na conversa. | Evoque Viagens",
      description:
        "Conecte Claude ou ChatGPT ao Evoque para propor reservas e revisar os dados da viagem.",
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
