import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plane, BedDouble, Bus, Car, TrainFront, ShieldCheck, TriangleAlert, CircleAlert, Receipt, Ticket as TicketIcon, Users } from "lucide-react";
import { Topo } from "@/components/Chrome";
import { expensesQuery, lodgingsQuery, membersQuery, ticketsQuery } from "@/lib/data";
import { useAuditoria } from "@/lib/auditoria";
import { chaveDia, dataBRCurta, fmtMoney, horaNoFuso, fusoLocal, nomeFusoCurto } from "@/lib/format";

export const Route = createFileRoute("/trip/$id/")({
  head: () => ({
    meta: [
      { title: "Visão geral da viagem — Evoque Viagens" },
      { name: "description", content: "Próximo compromisso, hora e local da sua viagem." },
      { property: "og:title", content: "Visão geral da viagem" },
      { property: "og:description", content: "Próximo compromisso, hora e local da sua viagem." },
    ],
  }),
  component: VisaoGeral,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-lg">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-lg">Viagem não encontrada.</div>,
});

const ICONE: Record<string, typeof Plane> = {
  voo: Plane,
  trem: TrainFront,
  onibus: Bus,
  carro: Car,
  transfer: Car,
};

function VisaoGeral() {
  const { id } = Route.useParams();
  const { trip, visiveis } = useAuditoria(id);
  const { data: bilhetes } = useSuspenseQuery(ticketsQuery(id));
  const { data: hospedagens } = useSuspenseQuery(lodgingsQuery(id));
  const { data: despesas } = useSuspenseQuery(expensesQuery(id));
  const { data: membros } = useSuspenseQuery(membersQuery(id));

  const agora = new Date().toISOString();
  const proximoBilhete = bilhetes.find((b) => b.partida_utc >= agora);
  const proximoHotel = hospedagens.find((h) => h.checkin >= agora);
  const usarBilhete =
    proximoBilhete && (!proximoHotel || proximoBilhete.partida_utc <= proximoHotel.checkin);
  const total = despesas.reduce((s, d) => s + Number(d.valor_moeda_base), 0);

  const grave = visiveis.find((a) => a.severidade === "resolver");
  const medio = visiveis.find((a) => a.severidade === "conferir");

  return (
    <>
      <Topo titulo={trip.nome} voltarPara="/" />
      <main className="space-y-4 px-4 pt-3">
        {usarBilhete && proximoBilhete ? (
          <CardProximo
            Icone={ICONE[proximoBilhete.tipo] ?? Plane}
            titulo={`${proximoBilhete.origem_iata ?? proximoBilhete.origem_cidade ?? "?"} → ${proximoBilhete.destino_iata ?? proximoBilhete.destino_cidade ?? "?"}`}
            hora={horaNoFuso(proximoBilhete.partida_utc, proximoBilhete.partida_tz)}
            dia={dataBRCurta(chaveDia(proximoBilhete.partida_utc, proximoBilhete.partida_tz))}
            local={[proximoBilhete.companhia, proximoBilhete.numero].filter(Boolean).join(" ") || (proximoBilhete.origem_cidade ?? "")}
            tz={proximoBilhete.partida_tz}
            iso={proximoBilhete.partida_utc}
          />
        ) : proximoHotel ? (
          <CardProximo
            Icone={BedDouble}
            titulo={proximoHotel.nome}
            hora={horaNoFuso(proximoHotel.checkin, fusoLocal())}
            dia={dataBRCurta(chaveDia(proximoHotel.checkin))}
            local={proximoHotel.cidade ?? proximoHotel.endereco ?? ""}
            tz={fusoLocal()}
            iso={proximoHotel.checkin}
          />
        ) : (
          <div className="gradient-hero shadow-medium rounded-3xl p-6">
            <h2 className="text-2xl">Nada agendado</h2>
            <p className="mt-2 text-lg opacity-90">Adicione um bilhete</p>
          </div>
        )}

        <Link
          to="/trip/$id/revisao"
          params={{ id }}
          className={`tap flex items-center gap-3 rounded-2xl px-4 py-3 ${
            grave
              ? "bg-danger text-danger-foreground"
              : medio
                ? "bg-warn text-warn-foreground"
                : "bg-ok text-ok-foreground"
          }`}
        >
          {grave ? (
            <CircleAlert size={28} strokeWidth={2.2} className="shrink-0" />
          ) : medio ? (
            <TriangleAlert size={28} strokeWidth={2.2} className="shrink-0" />
          ) : (
            <ShieldCheck size={28} strokeWidth={2.2} className="shrink-0" />
          )}
          <span className="text-base font-bold leading-snug">
            {grave?.mensagem ?? medio?.mensagem ?? "Tudo conferido nesta viagem."}
          </span>
        </Link>

        <div className="grid grid-cols-2 gap-3">
          <Atalho
            to="/trip/$id/despesas"
            id={id}
            Icone={Receipt}
            numero={fmtMoney(total, trip.moeda_base)}
            rotulo="Despesas"
          />
          <Atalho to="/trip/$id/bilhetes" id={id} Icone={TicketIcon} numero={String(bilhetes.length)} rotulo="Bilhetes" />
          <Atalho to="/trip/$id/hospedagem" id={id} Icone={BedDouble} numero={String(hospedagens.length)} rotulo="Hospedagem" />
          <Atalho to="/trip/$id/pessoas" id={id} Icone={Users} numero={String(membros.length)} rotulo="Pessoas" />
        </div>
      </main>
    </>
  );
}

function CardProximo({
  Icone,
  titulo,
  hora,
  dia,
  local,
  tz,
  iso,
}: {
  Icone: typeof Plane;
  titulo: string;
  hora: string;
  dia: string;
  local: string;
  tz: string;
  iso: string;
}) {
  const [hh, mm] = hora.split(":");
  const local2 = horaNoFuso(iso, fusoLocal());
  return (
    <section className="gradient-hero shadow-medium rounded-3xl p-6">
      <div className="flex items-center gap-3">
        <Icone size={40} strokeWidth={2.2} />
        <div>
          <p className="text-sm font-bold uppercase tracking-wide opacity-90">Próximo</p>
          <h2 className="text-xl leading-tight">{titulo}</h2>
        </div>
      </div>
      <p className="num mt-4 text-[42px] leading-none">
        {hh}
        <span className="opacity-50">:</span>
        {mm}
      </p>
      <p className="mt-2 text-lg font-semibold">
        {dia} · {local}
      </p>
      <p className="mt-1 text-sm opacity-85">
        {nomeFusoCurto(tz)} · {local2} no seu horário
      </p>
    </section>
  );
}

function Atalho({
  to,
  id,
  Icone,
  numero,
  rotulo,
}: {
  to: string;
  id: string;
  Icone: typeof Plane;
  numero: string;
  rotulo: string;
}) {
  return (
    <Link
      to={to as never}
      params={{ id } as never}
      className="shadow-soft flex min-h-[104px] flex-col justify-between rounded-2xl border border-border bg-card p-4"
    >
      <Icone size={28} strokeWidth={2.2} className="text-accent" />
      <span className="num truncate text-2xl text-foreground">{numero}</span>
      <span className="text-sm font-bold text-muted-foreground">{rotulo}</span>
    </Link>
  );
}
