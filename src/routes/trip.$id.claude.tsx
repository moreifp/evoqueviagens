import { createFileRoute } from "@tanstack/react-router";
import { Topo } from "@/components/Chrome";
import { CaixaClaude } from "@/components/CaixaClaude";

export const Route = createFileRoute("/trip/$id/claude")({
  head: () => ({
    meta: [
      { title: "Chegou pelo Claude — Evoque Viagens" },
      {
        name: "description",
        content: "Confirme com um toque os voos, hotéis e reservas que o Claude trouxe.",
      },
      { property: "og:title", content: "Chegou pelo Claude" },
      { property: "og:description", content: "Itens pendentes para confirmar na viagem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  const { id } = Route.useParams();
  return (
    <>
      <Topo titulo="Chegou pelo Claude" voltarPara="/trip/$id" voltarParams={{ id }} />
      <CaixaClaude tripId={id} />
    </>
  );
}
