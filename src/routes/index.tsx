import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { EuDashboard } from "@/components/EuDashboard";
import { Landing } from "@/components/Landing";
import { minhaPessoaQuery } from "@/lib/eu";
import { noHostLanding } from "@/lib/host";

const LANDING_TITULO = "Evoque Viagens — a viagem inteira, mesmo sem internet";
const LANDING_DESC = "Documentos, bilhetes, hotéis e reservas num lugar só — e o app confere se está tudo certo antes do aeroporto. Funciona sem internet.";
const OG_IMAGEM = "https://evoque.global/og-evoque.jpg";

export const Route = createFileRoute("/")({
  loader: () => ({ landing: noHostLanding() }),
  head: ({ loaderData }) =>
    loaderData?.landing
      ? {
          meta: [
            { title: LANDING_TITULO },
            { name: "description", content: LANDING_DESC },
            { name: "robots", content: "index, follow" },
            { property: "og:title", content: LANDING_TITULO },
            { property: "og:description", content: LANDING_DESC },
            { property: "og:type", content: "website" },
            { property: "og:url", content: "https://evoque.global/" },
            { property: "og:image", content: OG_IMAGEM },
            { name: "twitter:card", content: "summary_large_image" },
            { name: "twitter:image", content: OG_IMAGEM },
          ],
          links: [
            { rel: "canonical", href: "https://evoque.global/" },
            { rel: "preconnect", href: "https://fonts.googleapis.com" },
            { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
            { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&display=swap&text=%C3%89voque" },
          ],
        }
      : {
          meta: [
            { title: "Minha conta — Evoque Viagens" },
            { name: "description", content: "Seus documentos, fidelidade, preferências e compartilhamentos de viagem." },
            { property: "og:title", content: "Minha conta — Evoque Viagens" },
            { property: "og:description", content: "Seus dados pessoais de viagem, seguros e disponíveis offline." },
            { property: "og:type", content: "website" },
            { name: "twitter:card", content: "summary" },
          ],
        },
  component: Inicio,
});

function Inicio() {
  const { landing } = Route.useLoaderData();
  return landing ? <Landing /> : <MinhaConta />;
}

function MinhaConta() {
  const { data, isLoading, error } = useQuery({ ...minhaPessoaQuery(), retry: navigator.onLine ? 2 : 0 });
  if (isLoading) return <p className="p-6 text-lg text-muted-foreground">Preparando sua conta…</p>;
  if (error || !data) return <p className="p-6 text-lg text-danger">{error?.message ?? "Sua ficha ainda não está pronta."}</p>;
  return <EuDashboard personId={data.id} />;
}
