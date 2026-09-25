import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, CalendarDays, UtensilsCrossed, CircleDollarSign, Plus, User, Plane, Utensils, Wallet, WifiOff } from "lucide-react";
import { useConexao } from "@/lib/outbox";

export function Topo({
  titulo,
  voltarPara,
  voltarParams,
}: {
  titulo: string;
  voltarPara?: string;
  voltarParams?: Record<string, string>;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur">
      {voltarPara ? (
        <Link
          to={voltarPara as never}
          params={voltarParams as never}
          aria-label="Voltar"
          className="tap flex flex-col items-center justify-center rounded-xl text-foreground"
        >
          <ChevronLeft size={28} strokeWidth={2.2} />
          <span className="text-xs font-semibold">Voltar</span>
        </Link>
      ) : (
        <span className="w-2" />
      )}
      <h1 className="flex-1 truncate text-2xl">{titulo}</h1>
    </header>
  );
}

export function Avatar() {
  return null;
}

const ABAS = [
  { to: "/trip/$id", rotulo: "Programação", Icone: CalendarDays, exact: true },
  { to: "/trip/$id/restaurantes", rotulo: "Restaurantes", Icone: UtensilsCrossed, exact: false },
  { to: "/trip/$id/despesas", rotulo: "Dinheiro", Icone: CircleDollarSign, exact: false },
] as const;

export function BarraInferior({ tripId }: { tripId: string }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
      {ABAS.map(({ to, rotulo, Icone, exact }) => {
        const alvo = to.replace("$id", tripId);
        const ativo = exact ? path === alvo : path.startsWith(alvo);
        return (
          <Link
            key={to}
            to={to as never}
            params={{ id: tripId } as never}
            className={`tap flex flex-col items-center justify-center gap-1 py-2 ${
              ativo ? "text-accent" : "text-muted-foreground"
            }`}
          >
            <Icone size={26} strokeWidth={2.2} />
            <span className="text-xs font-bold">{rotulo}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function BotaoFlutuante({ tripId }: { tripId: string }) {
  return (
    <Link
      to="/trip/$id/despesas/nova"
      params={{ id: tripId }}
      aria-label="Lançar despesa"
      className="gradient-hero shadow-medium fixed bottom-24 right-4 z-20 flex h-[68px] w-[68px] flex-col items-center justify-center rounded-full"
    >
      <Plus size={30} strokeWidth={2.2} />
      <span className="text-xs font-bold">Gasto</span>
    </Link>
  );
}

const ABAS_APP = [
  { to: "/", rotulo: "Eu", Icone: User, exact: true },
  { to: "/viagens", rotulo: "Viagens", Icone: Plane, exact: false },
  { to: "/restaurantes", rotulo: "Restaurantes", Icone: Utensils, exact: false },
  { to: "/despesas", rotulo: "Despesas", Icone: Wallet, exact: false },
] as const;

export function AbasApp() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      aria-label="Seções do app"
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]"
    >
      {ABAS_APP.map(({ to, rotulo, Icone, exact }) => {
        const ativo = exact ? path === "/" || path.startsWith("/pessoas") : path.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            className={`tap flex flex-col items-center justify-center gap-1 py-2 ${
              ativo ? "text-accent" : "text-muted-foreground"
            }`}
          >
            <Icone size={26} strokeWidth={2.2} />
            <span className="text-sm font-bold">{rotulo}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AvisoConexao() {
  const { online, pendentes } = useConexao();
  if (online && pendentes === 0) return null;
  return (
    <div
      role="status"
      className="fixed left-1/2 top-2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-medium"
    >
      <WifiOff size={18} strokeWidth={2.2} />
      {online
        ? `Enviando ${pendentes} ${pendentes === 1 ? "alteração" : "alterações"}…`
        : pendentes > 0
          ? `Sem internet · ${pendentes} ${pendentes === 1 ? "alteração esperando" : "alterações esperando"} internet`
          : "Sem internet · usando o que está no aparelho"}
    </div>
  );
}
