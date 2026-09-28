import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, Plus, User, Plane, Utensils, Wallet, WifiOff, Images } from "lucide-react";
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

/** Dentro da viagem: a mesma barra de 4 abas de fora (Viagens fica marcada). */
export function BarraInferior({ tripId: _tripId }: { tripId: string }) {
  return <AbasApp />;
}

export function BotaoFlutuante({ tripId }: { tripId: string }) {
  return (
    <Link
      to="/trip/$id/adicionar"
      params={{ id: tripId }}
      aria-label="Adicionar à viagem"
      className="gradient-hero shadow-medium fixed bottom-24 right-4 z-20 flex h-[72px] min-w-[132px] items-center justify-center gap-2 rounded-full px-5"
    >
      <Plus size={30} strokeWidth={2.2} />
      <span className="text-lg font-bold">Adicionar</span>
    </Link>
  );
}

const ABAS_APP = [
  { to: "/", rotulo: "Eu", Icone: User, exact: true, cor: "doc" },
  { to: "/viagens", rotulo: "Viagens", Icone: Plane, exact: false, cor: "voos" },
  { to: "/restaurantes", rotulo: "Restaurantes", Icone: Utensils, exact: false, cor: "reserva" },
  { to: "/despesas", rotulo: "Despesas", Icone: Wallet, exact: false, cor: "desp" },
  { to: "/fotos", rotulo: "Fotos", Icone: Images, exact: false, cor: "pess" },
] as const;

const COR_ABA: Record<string, string> = {
  doc: "text-doc bg-doc-soft",
  voos: "text-voos bg-voos-soft",
  reserva: "text-reserva bg-reserva-soft",
  desp: "text-desp bg-desp-soft",
  pess: "text-pess bg-pess-soft",
};

export function AbasApp() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      aria-label="Seções do app"
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]"
    >
      {ABAS_APP.map(({ to, rotulo, Icone, exact, cor }) => {
        const ativo = exact ? path === "/" || path.startsWith("/pessoas") : path.startsWith(to) || (to === "/viagens" && path.startsWith("/trip") && !path.includes("/despesas") && !path.endsWith("/fotos")) || (to !== "/viagens" && path.startsWith("/trip") && path.includes(to));
        return (
          <Link
            key={to}
            to={to}
            className={`tap mx-0.5 my-1 flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl py-2 ${
              ativo ? COR_ABA[cor] : "text-muted-foreground"
            }`}
          >
            <Icone size={26} strokeWidth={2.2} />
            <span className="max-w-full truncate px-0.5 text-[13px] font-bold">{rotulo}</span>
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
