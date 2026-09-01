import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, CalendarDays, UtensilsCrossed, CircleDollarSign, Plus, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

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
      <Avatar />
    </header>
  );
}

export function Avatar() {
  const [aberto, setAberto] = useState(false);
  const navigate = useNavigate();
  return (
    <div className="relative">
      <button
        aria-label="Perfil"
        onClick={() => setAberto((a) => !a)}
        className="tap flex flex-col items-center justify-center rounded-full text-foreground"
      >
        <User size={28} strokeWidth={2.2} />
        <span className="text-xs font-semibold">Perfil</span>
      </button>
      {aberto && (
        <div className="shadow-medium absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-border bg-card p-2">
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              setAberto(false);
              navigate({ to: "/" });
            }}
            className="tap w-full rounded-lg px-4 text-left text-lg font-semibold text-foreground"
          >
            Sair
          </button>
        </div>
      )}
    </div>
  );
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
