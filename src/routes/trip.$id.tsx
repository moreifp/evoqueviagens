import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { Suspense } from "react";
import { BarraInferior, BotaoFlutuante } from "@/components/Chrome";

export const Route = createFileRoute("/trip/$id")({
  component: TripLayout,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-lg text-foreground">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-lg">Viagem não encontrada.</div>,
});

function TripLayout() {
  const { id } = Route.useParams();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const escondeFab = path.includes("/despesas") || path.endsWith("/adicionar") || path.includes("/item/") || path.endsWith("/novo") || path.endsWith("/nova");

  return (
    <div className="min-h-screen bg-background pb-28">
      <Suspense fallback={<p className="p-6 text-lg">Carregando…</p>}>
        <Outlet />
      </Suspense>
      {!escondeFab && <BotaoFlutuante tripId={id} />}
      <BarraInferior tripId={id} />
    </div>
  );
}
