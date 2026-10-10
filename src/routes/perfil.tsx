import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/perfil")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Minha conta — Viagens Organizadas" },
      { name: "description", content: "Acesse seus dados pessoais de viagem." },
      { property: "og:title", content: "Minha conta — Viagens Organizadas" },
      { property: "og:description", content: "Acesse seus dados pessoais de viagem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => null,
});
