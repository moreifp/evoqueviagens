import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/perfil")({
  beforeLoad: () => { throw redirect({ to: "/" }); },
  head: () => ({ meta: [
    { title: "Minha conta — Evoque Viagens" },
    { name: "description", content: "Acesse seus dados pessoais de viagem." },
    { property: "og:title", content: "Minha conta — Evoque Viagens" },
    { property: "og:description", content: "Acesse seus dados pessoais de viagem." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => null,
});