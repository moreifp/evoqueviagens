import { createFileRoute } from "@tanstack/react-router";
import { Topo } from "@/components/Chrome";
import { CaixaClaude } from "@/components/CaixaClaude";

export const Route = createFileRoute("/claude")({
  head: () => ({
    meta: [
      { title: "Chegou pelo Claude — Viagens Organizadas" },
      { name: "description", content: "Itens que o Claude trouxe, esperando sua confirmação." },
      { property: "og:title", content: "Chegou pelo Claude" },
      { property: "og:description", content: "Confirme com um toque o que chegou pelo Claude." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <div className="min-h-screen bg-background pb-28">
      <Topo titulo="Chegou pelo Claude" voltarPara="/viagens" />
      <CaixaClaude />
    </div>
  ),
});
