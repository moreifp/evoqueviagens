import { ChipClaude } from "@/components/CaixaClaude";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Map as IconeMapa, Plane, BedDouble, Bus, Car, TrainFront, ShieldCheck, TriangleAlert, CircleAlert, Users, CalendarCheck, Share2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VisaoParticipante } from "@/components/VisaoParticipante";
import { useQuery } from "@tanstack/react-query";
import { cancelado, formatarAtraso } from "@/lib/voo";
import { tripQuery, apiAlertaQuery, expensesQuery, flightStatusQuery, membersQuery, roteiroQuery, type ItemRoteiro } from "@/lib/data";
import { useAuditoria } from "@/lib/auditoria";
import { SeloOffline } from "@/components/SeloOffline";
import { CartaoEmergencia } from "@/components/CartaoEmergencia";
import { pontosQuery } from "@/lib/data";
import { carregarAeroportos, porIata, type Aeroporto } from "@/lib/aeroportos";
import { rotaDoDia, type Ponto } from "@/lib/mapas";
import { Logo } from "@/components/Logo";
import { logoCia } from "@/lib/logos";
import { chaveDia, dataBRCurta, horaNoFuso, fusoLocal, nomeFusoCurto } from "@/lib/format";

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
  const { data: trip } = useSuspenseQuery(tripQuery(id));
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  useEffect(() => { void supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null)); }, []);
  if (uid === undefined) return null;
  if (uid !== trip.owner_id) return <VisaoParticipante trip={trip} />;
  return <VisaoOrganizador id={id} />;
}

function VisaoOrganizador({ id }: { id: string }) {
  const { trip, visiveis } = useAuditoria(id);
  const { data: roteiro } = useSuspenseQuery(roteiroQuery(id));
  // Roteiro: todos os itens da viagem, inclusive os que a pessoa só vê em resumo.
  const bilhetes = roteiro.filter((r) => r.item_tipo === "ticket").map((r) => ({ id: r.item_id, tipo: r.subtipo, companhia: r.companhia, numero: r.numero, origem_iata: r.origem_iata, destino_iata: r.destino_iata, origem_cidade: null as string | null, destino_cidade: r.cidade, partida_utc: r.inicio_utc, partida_tz: r.inicio_tz, chegada_utc: r.fim_utc ?? r.inicio_utc, chegada_tz: r.fim_tz ?? r.inicio_tz }));
  const hospedagens = roteiro.filter((r) => r.item_tipo === "lodging").map((r) => ({ id: r.item_id, nome: r.titulo, cidade: r.cidade, endereco: null as string | null, checkin: r.inicio_utc, checkout: r.fim_utc ?? r.inicio_utc }));
  const reservas = roteiro.filter((r) => r.item_tipo === "reservation");
  const { data: despesas } = useSuspenseQuery(expensesQuery(id));
  const { data: membros } = useSuspenseQuery(membersQuery(id));

  const { data: status } = useQuery(flightStatusQuery(id));
  const { data: alertas } = useQuery(apiAlertaQuery(id));
  const agora = new Date().toISOString();
  // Faixa: mudança de horário ou cancelamento de voos ainda relevantes.
  const mudancas = bilhetes.flatMap((b) => {
    const s = status?.[b.id]; if (!s || b.tipo !== "voo") return [];
    const nome = [b.companhia, b.numero].filter(Boolean).join(" ");
    if (cancelado(s)) return [`${nome} foi cancelado.`];
    const nova = s.partida_real_utc ?? s.partida_revista_utc;
    if ((s.atraso_partida_min ?? 0) >= 15 && nova && Date.parse(s.chegada_real_utc ?? s.chegada_revista_utc ?? b.chegada_utc) > Date.now())
      return [`${nome} atrasou ${formatarAtraso(s.atraso_partida_min!)} · parte ${horaNoFuso(nova, b.partida_tz)}.`];
    return [];
  });
  const proximoBilhete = bilhetes.find((b) => b.partida_utc >= agora);
  const proximoHotel = hospedagens.find((h) => h.checkin >= agora);
  const usarBilhete =
    proximoBilhete && (!proximoHotel || proximoBilhete.partida_utc <= proximoHotel.checkin);
  void despesas;

  const grave = visiveis.find((a) => a.severidade === "resolver");
  const medio = visiveis.find((a) => a.severidade === "conferir");
  const { data: pontos = [] } = useQuery(pontosQuery(id));
  const [aeros, setAeros] = useState<Aeroporto[]>([]);
  useEffect(() => { void carregarAeroportos().then(setAeros); }, []);
  const pontosDoDia = (itens: ItemRoteiro[]): Ponto[] => itens.flatMap((it): Ponto[] => {
    if (it.item_tipo === "ticket") {
      const a = [it.origem_iata, it.destino_iata].map((c) => (c ? porIata(aeros, c) : null)).filter((x): x is Aeroporto => !!x);
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
      <header className="flex items-center gap-3 px-4 py-3"><Link to="/viagens" className="tap flex items-center text-lg font-bold">Voltar</Link><div className="min-w-0 flex-1"><h1 className="truncate text-2xl">{trip.nome}</h1><p className="text-base text-muted-foreground">{dataBRCurta(trip.data_inicio)} a {dataBRCurta(trip.data_fim)} · {trip.moeda_base.toLowerCase()} · você organiza</p></div><Link to="/nova-viagem" search={{ editar: trip.id }} className="tap flex flex-col items-center justify-center text-sm font-bold"><Pencil size={26}/>Editar</Link><button disabled aria-label="Compartilhar viagem em breve" className="tap flex items-center justify-center text-muted-foreground"><Share2 size={28}/></button></header>
      <main className="space-y-4 px-4 pt-3">
        <SeloOffline tripId={id} />
        <ChipClaude tripId={id} />
        {mudancas.map((m) => <Link key={m} to="/trip/$id/bilhetes" params={{ id }} className="tap flex items-center gap-3 rounded-2xl bg-warn px-4 py-3 text-warn-foreground"><Plane size={28} strokeWidth={2.2} className="shrink-0" /><span className="text-lg font-bold">{m}</span></Link>)}
        {alertas?.[0] && <p className="rounded-2xl border-2 border-warn px-4 py-3 text-lg font-semibold">{alertas[0].mensagem}</p>}
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

        <div className="grid grid-cols-2 gap-3"><Atalho to="/trip/$id/bilhetes" id={id} Icone={Plane} numero={String(bilhetes.length)} rotulo="Transporte" /><Atalho to="/trip/$id/hospedagem" id={id} Icone={BedDouble} numero={String(hospedagens.length)} rotulo="Hospedagem" /><Atalho to="/trip/$id/reservas" id={id} Icone={CalendarCheck} numero={String(reservas.length)} rotulo="Reservas" /><Atalho to="/trip/$id/pessoas" id={id} Icone={Users} numero={String(membros.length)} rotulo="Pessoas" /></div>
        <section className="space-y-5 pb-28"><h2 className="text-2xl">Roteiro por dia</h2>{Object.entries(porDia).map(([dia,itens]) => <div key={dia}><div className="mb-2 flex items-center gap-2"><h3 className="flex-1 text-lg font-extrabold uppercase">{dataBRCurta(dia)}</h3>{(() => { const u = rotaDoDia(pontosDoDia(itens)); return u ? <a href={u} target="_blank" rel="noopener noreferrer" className="tap flex items-center gap-2 text-base font-bold text-accent"><IconeMapa size={22} /> Ver o dia no mapa</a> : null; })()}</div><div className="divide-y divide-border rounded-[18px] border border-border bg-card">{itens.map((item) => <Link key={item.item_id} to="/trip/$id/item/$tipo/$itemId" params={{ id, tipo: item.item_tipo, itemId: item.item_id }} className="tap flex items-center gap-3 px-4"><strong className="num w-16 text-xl">{horaNoFuso(item.inicio_utc,item.inicio_tz)}</strong>{item.item_tipo === "ticket" && <Logo url={logoCia(item.companhia, item.numero)} Icone={ICONE[item.subtipo] ?? Plane} nome={item.companhia ?? "companhia"} tamanho={28} className="shrink-0 text-accent" />}<span className="min-w-0 flex-1"><strong className="block truncate text-lg">{item.titulo}</strong><span className="text-base text-muted-foreground">{item.pessoas.map(p=>p.nome).join(", ")}</span></span>{visiveis.some(a=>a.itens.some(x=>x.id===item.item_id))&&<span className="rounded-full bg-warn px-2 py-1 text-sm font-bold text-warn-foreground">Conferir</span>}</Link>)}</div></div>)}</section>
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
