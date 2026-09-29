import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { EuDashboard } from "@/components/EuDashboard";
import { lazy, Suspense } from "react";

const MarketingPage = lazy(() =>
  import("@/components/MarketingPage").then((m) => ({ default: m.MarketingPage })),
);
import { minhaPessoaQuery } from "@/lib/eu";
import { noHostLanding } from "@/lib/host";
import { marketingHead } from "@/lib/marketing-head";

const LANDING_TITULO = "Evoque Viagens | A viagem inteira. Mesmo sem internet.";
const LANDING_DESC =
  "Documentos, voos, hotéis e reservas em um só lugar. Confira pendências e tenha sua viagem salva à mão, mesmo sem internet.";

export const Route = createFileRoute("/")({
  loader: () => ({ landing: noHostLanding() }),
  head: ({ loaderData }) =>
    loaderData?.landing
      ? marketingHead({
          title: LANDING_TITULO,
          description: LANDING_DESC,
          path: "/",
          alternatePath: "/en",
          locale: "pt_BR",
          noindex: true,
          home: true,
        })
      : {
          meta: [
            { title: "Eu — Evoque Viagens" },
            {
              name: "description",
              content: "Seus documentos, fidelidade, preferências e compartilhamentos de viagem.",
            },
            { property: "og:title", content: "Eu — Evoque Viagens" },
            {
              property: "og:description",
              content: "Seus dados pessoais de viagem, seguros e disponíveis offline.",
            },
            { property: "og:type", content: "website" },
            { name: "twitter:card", content: "summary" },
          ],
        },
  component: Inicio,
});

function Inicio() {
  const { landing } = Route.useLoaderData();
  return landing ? (
    <Suspense fallback={<div className="min-h-screen" />}>
      <MarketingPage page="home-pt" />
    </Suspense>
  ) : (
    <MinhaConta />
  );
}

function MinhaConta() {
  const { data, isLoading, error } = useQuery({
    ...minhaPessoaQuery(),
    retry: navigator.onLine ? 2 : 0,
  });
  if (isLoading) return <p className="p-6 text-lg text-muted-foreground">Preparando sua conta…</p>;
  if (error || !data)
    return (
      <p className="p-6 text-lg text-danger">
        {error?.message ?? "Sua ficha ainda não está pronta."}
      </p>
    );
  return <EuDashboard personId={data.id} />;
}
