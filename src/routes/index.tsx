import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { EuDashboard } from "@/components/EuDashboard";
import { minhaPessoaQuery } from "@/lib/eu";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Minha conta — Evoque Viagens" },
    { name: "description", content: "Seus documentos, fidelidade, preferências e compartilhamentos de viagem." },
    { property: "og:title", content: "Minha conta — Evoque Viagens" },
    { property: "og:description", content: "Seus dados pessoais de viagem, seguros e disponíveis offline." },
  ] }),
  component: MinhaConta,
});

function MinhaConta() {
  const { data, isLoading, error } = useQuery({ ...minhaPessoaQuery(), retry: navigator.onLine ? 2 : 0 });
  if (isLoading) return <p className="p-6 text-lg text-muted-foreground">Preparando sua conta…</p>;
  if (error || !data) return <p className="p-6 text-lg text-danger">{error?.message ?? "Sua ficha ainda não está pronta."}</p>;
  return <EuDashboard personId={data.id} />;
}