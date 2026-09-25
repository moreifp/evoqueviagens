import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { BarraInferior, BotaoFlutuante } from "@/components/Chrome";

export const Route = createFileRoute("/trip/$id")({
  ssr: false,
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
  const escondeFab = path.endsWith("/despesas/nova");

  return (
    <div className="min-h-screen bg-background pb-28">
      <Outlet />
      {!escondeFab && <BotaoFlutuante tripId={id} />}
      <BarraInferior tripId={id} />
    </div>
  );
}
