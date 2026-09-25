import { createFileRoute } from "@tanstack/react-router";
import { EuDashboard } from "@/components/EuDashboard";

export const Route = createFileRoute("/pessoas/$pid/")({
  head: () => ({ meta: [
    { title: "Dados pessoais — Evoque Viagens" },
    { name: "description", content: "Documentos e dados pessoais compartilhados para organizar viagens." },
    { property: "og:title", content: "Dados pessoais — Evoque Viagens" },
    { property: "og:description", content: "Dados pessoais compartilhados com segurança e somente leitura." },
  ] }),
  component: Pessoa,
});

function Pessoa() {
  const { pid } = Route.useParams();
  return <EuDashboard personId={pid} back />;
}