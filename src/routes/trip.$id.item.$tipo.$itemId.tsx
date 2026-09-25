import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRightLeft, CalendarDays, Copy, Hotel as IconeHotel, Plane, Plus } from "lucide-react";
import { AbrirMapa } from "@/components/AbrirMapa";
import { Logo } from "@/components/Logo";
import { logoCia, logoSite } from "@/lib/logos";
import { toast } from "sonner";
import { AcoesItem } from "@/components/AcoesItem";
import { Autoria } from "@/components/Autoria";
import { AnexosItem } from "@/components/AnexosItem";
import { StatusVoo } from "@/components/StatusVoo";
import { VirarDespesa } from "@/components/VirarDespesa";
import { conferenciaNomesQuery, flightStatusQuery, lodgingsQuery, membersQuery, reservasQuery, ticketsQuery } from "@/lib/data";
import { chaveDia, dataBRCurta, fusoLocal, horaNoFuso } from "@/lib/format";

export const Route = createFileRoute("/trip/$id/item/$tipo/$itemId")({
  head: () => ({ meta: [{ title: "Detalhes da viagem — Evoque Viagens" }, { name: "description", content: "Detalhes, pessoas e anexos do item." }, { property: "og:title", content: "Detalhes da viagem" }, { property: "og:description", content: "Detalhes, pessoas e anexos do item." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Detalhe,
});

function Detalhe() {
  const { id, tipo, itemId } = Route.useParams();
  if (tipo === "ticket") return <Voo tripId={id} itemId={itemId} />;
  if (tipo === "lodging") return <Hotel tripId={id} itemId={itemId} />;
  return <ReservaDetalhe tripId={id} itemId={itemId} />;
}

function Cabecalho({ id, titulo }: { id: string; titulo: string }) {
  return <header className="flex items-center gap-3 p-4"><Link to="/trip/$id" params={{ id }} className="tap flex items-center text-lg font-bold">Voltar</Link><h1 className="min-w-0 flex-1 truncate text-2xl">{titulo}</h1></header>;
}

function Voo({ tripId, itemId }: { tripId: string; itemId: string }) {
  const { data: lista } = useSuspenseQuery(ticketsQuery(tripId));
  const { data: membros } = useSuspenseQuery(membersQuery(tripId));
  const { data: status } = useSuspenseQuery(flightStatusQuery(tripId));
  const { data: conferencia = [] } = useQuery({ ...conferenciaNomesQuery(itemId), retry: 1 });
  const item = lista.find((x) => x.id === itemId);
  if (!item) return <p className="p-6">Voo não encontrado.</p>;
  const partidaDia = chaveDia(item.partida_utc, item.partida_tz);
  const chegadaDia = chaveDia(item.chegada_utc, item.chegada_tz);
  const maisUm = Math.round((Date.parse(`${chegadaDia}T12:00:00Z`) - Date.parse(`${partidaDia}T12:00:00Z`)) / 864e5);
  return <><Cabecalho id={tripId} titulo="Voo" /><main className="mx-auto max-w-3xl space-y-5 px-4">
    <section className="rounded-[18px] bg-primary p-5 text-primary-foreground"><p className="flex items-center gap-3 text-xl font-bold"><Logo url={logoCia(item.companhia, item.numero)} Icone={Plane} nome={item.companhia ?? "companhia"} />{item.companhia} · {item.numero}</p><p className="mt-1 text-lg">{dataBRCurta(partidaDia)}</p><div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><div><small className="font-bold">ORIGEM</small><p className="text-3xl font-bold">{item.origem_iata ?? "—"}</p></div><ArrowRightLeft /><div className="text-right"><small className="font-bold">DESTINO</small><p className="text-3xl font-bold">{item.destino_iata ?? "—"}</p></div></div><p className="mt-3 flex justify-between text-[44px] leading-none"><span>{horaNoFuso(item.partida_utc, item.partida_tz)}</span><span>{horaNoFuso(item.chegada_utc, item.chegada_tz)}{maisUm > 0 && <sup className="ml-1 text-xl">+{maisUm}</sup>}</span></p><p className="mt-3 text-right text-base">Chegada {horaNoFuso(item.chegada_utc, fusoLocal())} no seu horário</p><button onClick={() => { void navigator.clipboard.writeText(item.localizador ?? ""); toast.success("Localizador copiado."); }} className="tap mt-2 text-lg font-bold">Localizador {item.localizador ?? "—"} <Copy className="inline" /></button></section>
    <StatusVoo b={item} s={status[itemId]} />
    <section><div className="flex items-center"><h2 className="flex-1 text-2xl">Passageiros · {item.passageiros.length}</h2><Link to="/trip/$id/bilhetes/novo" params={{ id: tripId }} search={{ editar: itemId }} className="tap flex items-center text-lg font-bold text-accent"><Plus /> Passageiro</Link></div>{item.passageiros.map((p) => { const nome = membros.find((x) => x.person_id === p.person_id)?.nome ?? "Passageiro"; const estado = conferencia.find((x) => x.person_id === p.person_id)?.estado; return <div key={p.id} className="border-b border-border py-3"><div className="flex items-center justify-between gap-2"><strong>{nome} · {p.assento || "sem assento"}</strong><span className={`rounded-full px-3 py-1 text-sm font-bold ${estado === "confere" ? "bg-ok text-ok-foreground" : "bg-warn text-warn-foreground"}`}>{estado === "confere" ? "Nome confere" : estado === "sem_passaporte" ? "Sem passaporte" : estado === "sem_acesso" ? "Sem acesso" : "Conferir"}</span></div><p className="text-base text-muted-foreground">{p.nome_no_bilhete || "Nome não informado"} · •••{p.eticket?.slice(-4) || "—"}</p></div>; })}</section>
    <Link to="/trip/$id/bilhetes/novo" params={{ id: tripId }} search={{ copiar: itemId } as never} className="tap flex w-full items-center justify-center rounded-lg border border-border bg-card text-lg font-bold">Copiar para a volta</Link>
    <AnexosItem tripId={tripId} itemTipo="ticket" itemId={itemId} podeEditar />
    <Autoria tipo="ticket" id={itemId}><AcoesItem tripId={tripId} tabela="ticket" id={itemId} editarPara="/trip/$id/bilhetes/novo" queryKey={ticketsQuery(tripId).queryKey} />
    <VirarDespesa tripId={tripId} tipo="ticket" itemId={itemId} expenseId={item.expense_id} descricao={`${item.companhia ?? "Voo"} ${item.numero ?? ""}`} data={item.partida_utc.slice(0, 10)} /></Autoria>
  </main></>;
}

function Hotel({ tripId, itemId }: { tripId: string; itemId: string }) {
  const { data: lista } = useSuspenseQuery(lodgingsQuery(tripId)); const { data: membros } = useSuspenseQuery(membersQuery(tripId)); const item = lista.find((x) => x.id === itemId);
  if (!item) return <p className="p-6">Hotel não encontrado.</p>;
  return <><Cabecalho id={tripId} titulo={item.nome} /><main className="mx-auto max-w-3xl space-y-5 px-4">{logoSite(item.site) && <div className="flex items-center gap-3"><Logo url={logoSite(item.site)} Icone={IconeHotel} nome={item.nome} tamanho={40} /><span className="text-lg font-bold">{item.cidade}</span></div>}<section className="grid grid-cols-2 gap-3 rounded-[18px] border border-border bg-card p-5"><div><small>CHECK-IN</small><strong className="block text-3xl">{dataBRCurta(item.checkin.slice(0, 10))}</strong></div><div><small>CHECK-OUT</small><strong className="block text-3xl">{dataBRCurta(item.checkout.slice(0, 10))}</strong></div></section><AbrirMapa ponto={{ nome: item.nome, endereco: item.endereco, lat: item.lat, lng: item.lng, place_id: item.place_id }} />{item.localizador && <button onClick={() => { void navigator.clipboard.writeText(item.localizador!); toast.success("Localizador copiado."); }} className="tap flex items-center gap-2 text-lg font-bold text-accent">Localizador {item.localizador} <Copy /></button>}{item.cancelamento_gratis_ate && <p className="rounded-lg bg-ok p-4 text-lg font-bold text-ok-foreground">Cancela grátis até {dataBRCurta(item.cancelamento_gratis_ate)}</p>}<section><div className="flex items-center"><h2 className="flex-1 text-2xl">Quartos · {item.quartos.length}</h2><Link to="/trip/$id/hospedagem/nova" params={{ id: tripId }} search={{ editar: itemId }} className="tap flex items-center text-lg font-bold text-accent"><Plus /> Quarto</Link></div>{item.quartos.map((q) => <div key={q.id} className="mt-3 rounded-[18px] border border-border bg-card p-4"><strong>{q.nome} · {q.tipo}</strong><p>{q.hospedes.map((g) => membros.find((x) => x.person_id === g.person_id)?.nome).filter(Boolean).join(", ") || "Sem hóspedes"}</p><Link to="/trip/$id/hospedagem/nova" params={{ id: tripId }} search={{ editar: itemId }} className="mt-2 inline-flex min-h-14 items-center text-lg font-bold text-accent">Mudar</Link></div>)}</section><AnexosItem tripId={tripId} itemTipo="lodging" itemId={itemId} podeEditar /><Autoria tipo="lodging" id={itemId}><AcoesItem tripId={tripId} tabela="lodging" id={itemId} editarPara="/trip/$id/hospedagem/nova" queryKey={lodgingsQuery(tripId).queryKey} /><VirarDespesa tripId={tripId} tipo="lodging" itemId={itemId} expenseId={item.expense_id} descricao={item.nome} valor={item.valor} moeda={item.moeda} data={item.checkin.slice(0, 10)} /></Autoria></main></>;
}

function ReservaDetalhe({ tripId, itemId }: { tripId: string; itemId: string }) {
  const { data: lista } = useSuspenseQuery(reservasQuery(tripId)); const { data: membros } = useSuspenseQuery(membersQuery(tripId)); const item = lista.find((x) => x.id === itemId);
  if (!item) return <p className="p-6">Reserva não encontrada.</p>;
  return <><Cabecalho id={tripId} titulo={item.titulo} /><main className="mx-auto max-w-3xl space-y-5 px-4"><section className="rounded-[18px] border border-border bg-card p-5"><CalendarDays size={32} className="text-accent" /><p className="mt-3 text-3xl font-bold">{dataBRCurta(item.inicio_utc.slice(0, 10))} · {horaNoFuso(item.inicio_utc, item.inicio_tz)}</p><p className="text-lg">{item.local} · {item.cidade}</p></section><AbrirMapa ponto={{ nome: item.titulo, endereco: [item.local, item.cidade].filter(Boolean).join(", ") || null, lat: item.lat, lng: item.lng, place_id: item.place_id }} /><section className="rounded-[18px] border border-border bg-card p-5"><p className="text-lg">Quem vai: {item.pessoas.map((p) => membros.find((x) => x.person_id === p.person_id)?.nome).filter(Boolean).join(", ") || "não informado"}</p></section><AnexosItem tripId={tripId} itemTipo="reservation" itemId={itemId} podeEditar /><Autoria tipo="reservation" id={itemId}><AcoesItem tripId={tripId} tabela="reservation" id={itemId} editarPara="/trip/$id/reservas/nova" queryKey={reservasQuery(tripId).queryKey} /><VirarDespesa tripId={tripId} tipo="reservation" itemId={itemId} expenseId={item.expense_id} descricao={item.titulo} valor={item.valor} moeda={item.moeda} data={item.inicio_utc.slice(0, 10)} /></Autoria></main></>;
}