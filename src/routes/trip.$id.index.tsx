import { AvisosEscondidos } from "@/lib/escondidos";
import { ChipClaude } from "@/components/CaixaClaude";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Map as IconeMapa,
  Plane,
  BedDouble,
  Bus,
  Car,
  TrainFront,
  ShieldCheck,
  TriangleAlert,
  CircleAlert,
  Users,
  CalendarCheck,
  MapPin,
  Pencil,
  Wallet,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VisaoParticipante } from "@/components/VisaoParticipante";
import { useQuery } from "@tanstack/react-query";
import { cancelado, formatarAtraso } from "@/lib/voo";
import {
  settlementsQuery,
  tripQuery,
  apiAlertaQuery,
  expensesQuery,
  flightStatusQuery,
  membersQuery,
  roteiroQuery,
  type ItemRoteiro,
} from "@/lib/data";
import { useAuditoria } from "@/lib/auditoria";
import { SeloOffline } from "@/components/SeloOffline";
import { CartaoEmergencia } from "@/components/CartaoEmergencia";
import { pontosQuery } from "@/lib/data";
import { carregarAeroportos, porIata, type Aeroporto } from "@/lib/aeroportos";
import { rotaDoDia, type Ponto } from "@/lib/mapas";
import { Logo } from "@/components/Logo";
import { logoCia } from "@/lib/logos";
import { resumoSaldos } from "@/lib/saldos";
import { fmtMoney } from "@/lib/format";
import { chaveDia, dataBRCurta, diasAte, horaNoFuso, fusoLocal, nomeFusoCurto } from "@/lib/format";
import { AvatarGrupo } from "@/components/AvatarGrupo";

export const Route = createFileRoute("/trip/$id/")({
  head: () => ({
    meta: [
      { title: "Visão geral da viagem — Evoque Viagens" },
      { name: "description", content: "Próximo compromisso, hora e local da sua viagem." },
      { property: "og:title", content: "Visão geral da viagem" },
      { property: "og:description", content: "Próximo compromisso, hora e local da sua viagem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VisaoGeral,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-lg">
      {(error as Error).message}
    </div>
  ),
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
  const { data: trip } = useSuspenseQuery(tripQuery(id));
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null));
  }, []);
  if (uid === undefined) return null;
  if (uid !== trip.owner_id) return <VisaoParticipante trip={trip} />;
  return <VisaoOrganizador id={id} />;
}

function VisaoOrganizador({ id }: { id: string }) {
  const [roteiroAberto, setRoteiroAberto] = useState(false);
  const { trip, visiveis } = useAuditoria(id);
  const { data: roteiro } = useSuspenseQuery(roteiroQuery(id));
  const { data: tripCompleta } = useSuspenseQuery(tripQuery(id));
  // Roteiro: todos os itens da viagem, inclusive os que a pessoa só vê em resumo.
  const bilhetes = roteiro
    .filter((r) => r.item_tipo === "ticket")
    .map((r) => ({
      id: r.item_id,
      tipo: r.subtipo,
      companhia: r.companhia,
      numero: r.numero,
      origem_iata: r.origem_iata,
      destino_iata: r.destino_iata,
      origem_cidade: null as string | null,
      destino_cidade: r.cidade,
      partida_utc: r.inicio_utc,
      partida_tz: r.inicio_tz,
      chegada_utc: r.fim_utc ?? r.inicio_utc,
      chegada_tz: r.fim_tz ?? r.inicio_tz,
    }));
  const hospedagens = roteiro
    .filter((r) => r.item_tipo === "lodging")
    .map((r) => ({
      id: r.item_id,
      nome: r.titulo,
      cidade: r.cidade,
      endereco: null as string | null,
      checkin: r.inicio_utc,
      checkout: r.fim_utc ?? r.inicio_utc,
    }));
  const reservas = roteiro.filter((r) => r.item_tipo === "reservation");
  const { data: despesas } = useSuspenseQuery(expensesQuery(id));
  const { data: membros } = useSuspenseQuery(membersQuery(id));

  const { data: status } = useQuery(flightStatusQuery(id));
  const { data: alertas } = useQuery(apiAlertaQuery(id));
  const agora = new Date().toISOString();
  // Faixa: mudança de horário ou cancelamento de voos ainda relevantes.
  const mudancas = bilhetes.flatMap((b) => {
    const s = status?.[b.id];
    if (!s || b.tipo !== "voo") return [];
    const nome = [b.companhia, b.numero].filter(Boolean).join(" ");
    if (cancelado(s)) return [`${nome} foi cancelado.`];
    const nova = s.partida_real_utc ?? s.partida_revista_utc;
    if (
      (s.atraso_partida_min ?? 0) >= 15 &&
      nova &&
      Date.parse(s.chegada_real_utc ?? s.chegada_revista_utc ?? b.chegada_utc) > Date.now()
    )
      return [
        `${nome} atrasou ${formatarAtraso(s.atraso_partida_min!)} · parte ${horaNoFuso(nova, b.partida_tz)}.`,
      ];
    return [];
  });
  const proximoBilhete = bilhetes.find((b) => b.partida_utc >= agora);
  // Hotel atual continua aparecendo até o check-out.
  const proximoHotel = hospedagens.find((h) => h.checkout >= agora);
  const hotelEmCurso = !!proximoHotel && proximoHotel.checkin < agora;
  const usarBilhete =
    proximoBilhete &&
    (!proximoHotel ||
      proximoBilhete.partida_utc <= (hotelEmCurso ? proximoHotel.checkout : proximoHotel.checkin));
  const { data: acertos = [] } = useQuery(settlementsQuery(id));
  const { saldos, eu } = resumoSaldos(despesas, acertos, membros);
  const meuSaldo = eu ? (saldos[eu] ?? 0) : 0;
  const totalDesp = despesas.reduce((a, d) => a + Number(d.valor_moeda_base ?? 0), 0);

  const grave = visiveis.find((a) => a.severidade === "resolver");
  const medio = visiveis.find((a) => a.severidade === "conferir");
  const { data: pontos = [] } = useQuery(pontosQuery(id));
  const [aeros, setAeros] = useState<Aeroporto[]>([]);
  useEffect(() => {
    void carregarAeroportos().then(setAeros);
  }, []);
  const pontosDoDia = (itens: ItemRoteiro[]): Ponto[] =>
    itens.flatMap((it): Ponto[] => {
      if (it.item_tipo === "ticket") {
        const a = [it.origem_iata, it.destino_iata]
          .map((c) => (c ? porIata(aeros, c) : null))
          .filter((x): x is Aeroporto => !!x);
        return a.map((x) => ({ nome: `${x.iata} ${x.nome}`, lat: x.lat, lng: x.lng }));
      }
      const p = pontos.find((x) => x.item_id === it.item_id);
      return p ? [{ nome: p.titulo, lat: p.lat, lng: p.lng, place_id: p.place_id }] : [];
    });
  const porDia = roteiro.reduce<Record<string, ItemRoteiro[]>>((acc, item) => {
    const dia = chaveDia(item.inicio_utc, item.inicio_tz);
    (acc[dia] ??= []).push(item);
    return acc;
  }, {});

  return (
    <>
      <header className="flex items-center gap-3 px-4 py-3">
        <Link
          to="/viagens"
          aria-label="Voltar"
          className="tap flex flex-col items-center justify-center rounded-xl text-foreground"
        >
          <ChevronLeft size={28} strokeWidth={2.2} />
          <span className="text-xs font-semibold">Voltar</span>
        </Link>
        <div className="flex-1" />
        <Link
          to="/nova-viagem"
          search={{ editar: trip.id }}
          className="tap flex flex-col items-center justify-center text-sm font-bold"
        >
          <Pencil size={26} />
          Editar
        </Link>
      </header>
      <div className="px-4">
        <div className="gradient-hero shadow-medium rounded-[18px] p-5">
          <p className="text-base font-extrabold uppercase">
            {diasAte(trip.data_inicio) > 0 ? `Em ${diasAte(trip.data_inicio)} dias` : "Em andamento"}
          </p>
          <h1 className="mt-3 text-3xl">{trip.nome}</h1>
          <p className="mt-2 flex items-center gap-2 text-lg">
            <MapPin size={23} />
            {trip.cidades?.join(" · ") || trip.destino || "Cidades a definir"}
          </p>
          <p className="mt-1 text-lg">
            {dataBRCurta(trip.data_inicio)} a {dataBRCurta(trip.data_fim)}
          </p>
          <p className="mt-3 text-lg font-bold">Você organiza</p>
          <div className="mt-4">
            <AvatarGrupo nomes={membros.map((m) => m.nome)} />
          </div>
        </div>
      </div>
      <main className="space-y-4 px-4 pt-3">
        <SeloOffline tripId={id} />
        <ChipClaude tripId={id} />
        {mudancas.map((m) => (
          <Link
            key={m}
            to="/trip/$id/bilhetes"
            params={{ id }}
            className="tap flex items-center gap-3 rounded-2xl bg-warn px-4 py-3 text-warn-foreground"
          >
            <Plane size={28} strokeWidth={2.2} className="shrink-0" />
            <span className="text-lg font-bold">{m}</span>
          </Link>
        ))}
        {alertas?.[0] && (
          <p className="rounded-2xl border-2 border-warn px-4 py-3 text-lg font-semibold">
            {alertas[0].mensagem}
          </p>
        )}
        {usarBilhete && proximoBilhete ? (
          <CardProximo
            para={{ id, tipo: "ticket", itemId: proximoBilhete.id }}
            tonalidade="voos"
            Icone={ICONE[proximoBilhete.tipo] ?? Plane}
            logo={proximoBilhete.tipo === "voo" ? logoCia(proximoBilhete.companhia, proximoBilhete.numero) : null}
            titulo={`${proximoBilhete.origem_iata ?? proximoBilhete.origem_cidade ?? "?"} → ${proximoBilhete.destino_iata ?? proximoBilhete.destino_cidade ?? "?"}`}
            hora={horaNoFuso(proximoBilhete.partida_utc, proximoBilhete.partida_tz)}
            dia={dataBRCurta(chaveDia(proximoBilhete.partida_utc, proximoBilhete.partida_tz))}
            local={
              [proximoBilhete.companhia, proximoBilhete.numero].filter(Boolean).join(" ") ||
              (proximoBilhete.origem_cidade ?? "")
            }
            tz={proximoBilhete.partida_tz}
            iso={proximoBilhete.partida_utc}
          />
        ) : proximoHotel ? (
          <CardProximo
            para={{ id, tipo: "lodging", itemId: proximoHotel.id }}
            rotulo={hotelEmCurso ? "Hospedado · check-out" : "Próximo"}
            tonalidade="hosp"
            Icone={BedDouble}
            titulo={proximoHotel.nome}
            hora={horaNoFuso(
              hotelEmCurso ? proximoHotel.checkout : proximoHotel.checkin,
              fusoLocal(),
            )}
            dia={dataBRCurta(chaveDia(hotelEmCurso ? proximoHotel.checkout : proximoHotel.checkin))}
            local={proximoHotel.cidade ?? proximoHotel.endereco ?? ""}
            tz={fusoLocal()}
            iso={hotelEmCurso ? proximoHotel.checkout : proximoHotel.checkin}
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
            to="/trip/$id/bilhetes"
            id={id}
            Icone={Plane}
            numero={String(bilhetes.length)}
            rotulo="Transporte"
            cor="voos"
          />
          <Atalho
            to="/trip/$id/hospedagem"
            id={id}
            Icone={BedDouble}
            numero={String(hospedagens.length)}
            rotulo="Hospedagem"
            cor="hosp"
          />
          <Atalho
            to="/trip/$id/reservas"
            id={id}
            Icone={CalendarCheck}
            numero={String(reservas.length)}
            rotulo="Reservas"
            cor="reserva"
          />
          <Atalho
            to="/trip/$id/pessoas"
            id={id}
            Icone={Users}
            numero={String(membros.length)}
            rotulo="Pessoas"
            cor="pess"
          />
          <Link
            to="/trip/$id/despesas"
            params={{ id }}
            className="novo-cor shadow-soft col-span-2 flex min-h-[72px] items-center gap-3 rounded-2xl border border-desp-border bg-desp-soft p-4"
          >
            <Wallet size={28} strokeWidth={2.2} className="novo-cor-icone shrink-0 text-desp" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-muted-foreground">Despesas</span>
              <span className="num block truncate text-2xl text-foreground">
                {fmtMoney(totalDesp, tripCompleta.moeda_base)}
              </span>
            </span>
            {eu && (
              <span
                className={`text-right text-base font-bold ${meuSaldo > 0 ? "text-recebe" : meuSaldo < 0 ? "text-deve" : "text-emdia"}`}
              >
                {meuSaldo > 0
                  ? `você recebe ${fmtMoney(meuSaldo / 100, tripCompleta.moeda_base)}`
                  : meuSaldo < 0
                    ? `você deve ${fmtMoney(-meuSaldo / 100, tripCompleta.moeda_base)}`
                    : "em dia"}
              </span>
            )}
          </Link>
        </div>
        <CartaoEmergencia trip={tripCompleta} editavel />
        <section className="overflow-hidden rounded-2xl border border-border bg-card pb-0">
          <button
            type="button"
            onClick={() => setRoteiroAberto((v) => !v)}
            aria-expanded={roteiroAberto}
            className="tap flex w-full items-center justify-between px-4 text-left"
          >
            <span className="text-xl font-bold">Roteiro por dia</span>
            {roteiroAberto ? <ChevronUp size={26} /> : <ChevronDown size={26} />}
          </button>
          {roteiroAberto && (
            <div className="space-y-5 border-t border-border p-4 pb-28">
              {Object.entries(porDia).map(([dia, itens]) => (
                <div key={dia}>
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="flex-1 text-lg font-extrabold uppercase">{dataBRCurta(dia)}</h3>
                    {(() => {
                      const u = rotaDoDia(pontosDoDia(itens));
                      return u ? (
                        <a
                          href={u}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tap flex items-center gap-2 text-base font-bold text-accent"
                        >
                          <IconeMapa size={22} /> Ver o dia no mapa
                        </a>
                      ) : null;
                    })()}
                  </div>
                  <div className="divide-y divide-border rounded-[18px] border border-border bg-card">
                    {itens.map((item) => (
                      <Link
                        key={item.item_id}
                        to="/trip/$id/item/$tipo/$itemId"
                        params={{ id, tipo: item.item_tipo, itemId: item.item_id }}
                        className="tap flex items-center gap-3 px-4"
                      >
                        <strong className="num w-16 text-xl">
                          {horaNoFuso(item.inicio_utc, item.inicio_tz)}
                        </strong>
                        {item.item_tipo === "ticket" ? (
                          <Logo
                            url={logoCia(item.companhia, item.numero)}
                            Icone={ICONE[item.subtipo] ?? Plane}
                            nome={item.companhia ?? "companhia"}
                            tamanho={28}
                            className="shrink-0 text-voos"
                          />
                        ) : (
                          <span
                            className={`flex size-9 shrink-0 items-center justify-center rounded-full ${item.item_tipo === "lodging" ? "bg-hosp-soft text-hosp" : "bg-reserva-soft text-reserva"}`}
                          >
                            {item.item_tipo === "lodging" ? (
                              <BedDouble size={20} strokeWidth={2.2} />
                            ) : (
                              <CalendarCheck size={20} strokeWidth={2.2} />
                            )}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-lg">{item.titulo}</strong>
                          <span className="text-base text-muted-foreground">
                            {item.pessoas.map((p) => p.nome).join(", ")}
                          </span>
                        </span>
                        {visiveis.some((a) => a.itens.some((x) => x.id === item.item_id)) && (
                          <span className="rounded-full bg-warn px-2 py-1 text-sm font-bold text-warn-foreground">
                            Conferir
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <AvisosEscondidos contextos={[id]} />
      </main>
    </>
  );
}

function CardProximo({
  para,
  rotulo = "Próximo",
  tonalidade = "hero",
  Icone,
  titulo,
  hora,
  dia,
  local,
  tz,
  iso,
  logo = null,
}: {
  /** Logo da companhia (voo); sem logo ou se falhar, fica o ícone. */
  logo?: string | null;
  para: { id: string; tipo: string; itemId: string };
  rotulo?: string;
  tonalidade?: "voos" | "hosp" | "hero";
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
  const fundo =
    tonalidade === "voos"
      ? "gradient-voos"
      : tonalidade === "hosp"
        ? "gradient-hosp"
        : "gradient-hero";
  return (
    <Link
      to="/trip/$id/item/$tipo/$itemId"
      params={para}
      className={`${fundo} shadow-medium block rounded-3xl p-6`}
    >
      <div className="flex items-center gap-3">
        <Logo url={logo} Icone={Icone} nome={local || titulo} tamanho={40} className="shrink-0" />
        <div>
          <p className="text-sm font-bold uppercase tracking-wide opacity-90">{rotulo}</p>
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
    </Link>
  );
}

const COR_FUNDO: Record<string, string> = {
  voos: "border-voos-border bg-voos-soft",
  hosp: "border-hosp-border bg-hosp-soft",
  reserva: "border-reserva-border bg-reserva-soft",
  pess: "border-pess-border bg-pess-soft",
};

const COR_TEXTO: Record<string, string> = {
  voos: "text-voos",
  hosp: "text-hosp",
  reserva: "text-reserva",
  pess: "text-pess",
};

function Atalho({
  to,
  id,
  Icone,
  numero,
  rotulo,
  cor,
}: {
  to: string;
  id: string;
  Icone: typeof Plane;
  numero: string;
  rotulo: string;
  cor: keyof typeof COR_FUNDO;
}) {
  return (
    <Link
      to={to as never}
      params={{ id } as never}
      className={`novo-cor shadow-soft flex min-h-[104px] flex-col justify-between rounded-2xl border p-4 ${COR_FUNDO[cor]}`}
    >
      <Icone size={28} strokeWidth={2.2} className={`novo-cor-icone ${COR_TEXTO[cor]}`} />
      <span className="num truncate text-2xl text-foreground">{numero}</span>
      <span className="text-sm font-bold text-muted-foreground">{rotulo}</span>
    </Link>
  );
}
