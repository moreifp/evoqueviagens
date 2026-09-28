import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRightLeft, CalendarDays, Copy, Hotel as IconeHotel, Luggage, Navigation, Phone, Plane, Plus } from "lucide-react";
import { linkGoogle } from "@/lib/mapas";
import { textoBagagem } from "@/lib/bagagem";
import { AbrirMapa } from "@/components/AbrirMapa";
import { Logo } from "@/components/Logo";
import { logoCia, logoSite } from "@/lib/logos";
import { toast } from "sonner";
import { AcoesItem } from "@/components/AcoesItem";
import { Topo } from "@/components/Chrome";
import { autoriaQuery } from "@/lib/data";
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
  return <Topo titulo={titulo} voltarPara="/trip/$id" voltarParams={{ id }} />;
}

const iniciais = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
const diaCurto = (iso: string, tz: string) => { const d = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: tz }).format(new Date(iso)).replace(".", ""); return `${d[0]!.toUpperCase()}${d.slice(1)} ${chaveDia(iso, tz).slice(5).split("-").reverse().join("/")}`; };
const copiar = (v: string) => { void navigator.clipboard.writeText(v); toast.success("Localizador copiado."); };

function Voo({ tripId, itemId }: { tripId: string; itemId: string }) {
  const { data: lista } = useSuspenseQuery(ticketsQuery(tripId));
  const { data: membros } = useSuspenseQuery(membersQuery(tripId));
  const { data: status } = useSuspenseQuery(flightStatusQuery(tripId));
  const { data: conferencia = [] } = useQuery({ ...conferenciaNomesQuery(itemId), retry: 1 });
  const item = lista.find((x) => x.id === itemId);
  if (!item) return <p className="p-6">Voo não encontrado.</p>;
  const st = status[itemId];
  const partidaDia = chaveDia(item.partida_utc, item.partida_tz);
  const chegadaDia = chaveDia(item.chegada_utc, item.chegada_tz);
  const maisUm = Math.round((Date.parse(`${chegadaDia}T12:00:00Z`) - Date.parse(`${partidaDia}T12:00:00Z`)) / 864e5);
  const padrao = textoBagagem(item);
  const dif = item.passageiros.filter((p) => { const t = textoBagagem(p); return t && t !== padrao; });
  const de = item.origem_iata ?? item.origem_cidade ?? "?", para = item.destino_iata ?? item.destino_cidade ?? "?";
  return <><Cabecalho id={tripId} titulo={`Voo ${de} → ${para}`} /><main className="mx-auto max-w-3xl space-y-5 px-4 pt-3">
    <p className="-mt-1 text-lg text-muted-foreground">{diaCurto(item.partida_utc, item.partida_tz)} · {[item.companhia, item.numero].filter(Boolean).join(" ")}</p>
    <AcoesTopo tipo="ticket" itemId={itemId} tripId={tripId} editarPara="/trip/$id/bilhetes/novo" queryKey={ticketsQuery(tripId).queryKey} destaque="voos" />
    <section className="cartao-voo gradient-voos shadow-medium rounded-3xl p-5 text-white">
      <p className="flex items-center gap-3 text-lg font-bold"><Logo url={logoCia(item.companhia, item.numero)} Icone={Plane} nome={item.companhia ?? "companhia"} />{[item.companhia, item.numero].filter(Boolean).join(" · ")}</p>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <div><p className="text-[40px] font-extrabold leading-none">{item.origem_iata ?? "—"}</p><p className="num mt-1 text-3xl">{horaNoFuso(item.partida_utc, item.partida_tz)}</p><p className="mt-1 text-base">{[item.origem_cidade, st?.terminal_partida && `Terminal ${st.terminal_partida}`].filter(Boolean).join(" · ")}</p></div>
        <Plane size={28} className="mb-8" aria-hidden />
        <div className="text-right"><p className="text-[40px] font-extrabold leading-none">{item.destino_iata ?? "—"}</p><p className="num mt-1 text-3xl">{horaNoFuso(item.chegada_utc, item.chegada_tz)}{maisUm > 0 && <sup className="ml-1 text-lg">+{maisUm}</sup>}</p><p className="mt-1 text-base">{[item.destino_cidade, st?.terminal_chegada && `Terminal ${st.terminal_chegada}`].filter(Boolean).join(" · ")}</p></div>
      </div>
      <p className="mt-2 text-right text-sm opacity-90">Chegada {horaNoFuso(item.chegada_utc, fusoLocal())} no seu horário</p>
      {(() => { const cs = item.passageiros.filter((p) => p.classe); if (!cs.length) return null; const unicas = [...new Set(cs.map((p) => p.classe))]; return <p className="mt-1 text-base font-bold">{unicas.length === 1 ? <>Classe {unicas[0]}</> : cs.map((p) => `${membros.find((x) => x.person_id === p.person_id)?.nome?.split(" ")[0] ?? "Passageiro"}: ${p.classe}`).join(" · ")}</p>; })()}
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/30 pt-3">
        <button type="button" onClick={() => item.localizador && copiar(item.localizador)} className="tap min-h-14 text-left"><small className="block text-sm font-bold uppercase opacity-90">Reserva</small><span className="mono-code flex items-center gap-1 text-xl font-bold">{item.localizador ?? "—"}{item.localizador && <Copy size={18} aria-hidden />}</span></button>
        <div className="text-right"><small className="block text-sm font-bold uppercase opacity-90">Bagagem</small><span className="text-base font-bold">{padrao || "Não informada"}</span></div>
      </div>
    </section>
    <StatusVoo b={item} s={st} />
    <section><div className="flex items-center"><h2 className="flex-1 text-2xl">Passageiros · {item.passageiros.length}</h2></div>{item.passageiros.map((p) => { const nome = membros.find((x) => x.person_id === p.person_id)?.nome ?? "Passageiro"; const estado = conferencia.find((x) => x.person_id === p.person_id)?.estado; return <div key={p.id} className="border-b border-border py-3"><div className="flex items-center justify-between gap-2"><strong>{nome} · {p.assento || "sem assento"}{p.classe ? ` · ${p.classe}` : ""}</strong><span className={`rounded-full px-3 py-1 text-sm font-bold ${estado === "confere" ? "bg-ok text-ok-foreground" : estado === "diferente" ? "bg-danger text-danger-foreground" : "bg-warn text-warn-foreground"}`}>{estado === "confere" ? "Nome confere" : estado === "diferente" ? "Nome diferente" : estado === "sem_passaporte" ? "Sem passaporte" : estado === "sem_acesso" ? "Sem acesso" : "Conferir"}</span></div><p className="text-base text-muted-foreground">{p.nome_no_bilhete || "Nome não informado"} · •••{p.eticket?.slice(-4) || "—"}</p>{dif.includes(p) && <p className="flex items-center gap-1 text-base text-muted-foreground"><Luggage size={18} aria-hidden /> {textoBagagem(p)}</p>}</div>; })}</section>
    <div className="grid grid-cols-2 gap-2">
      <Link to="/trip/$id/bilhetes/novo" params={{ id: tripId }} search={{ copiar: itemId } as never} className="tap flex items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card text-lg font-bold"><ArrowRightLeft size={22} /> Copiar p/ volta</Link>
      <Autoria tipo="ticket" id={itemId}><VirarDespesa className="tap flex items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card text-lg font-bold text-foreground" tripId={tripId} tipo="ticket" itemId={itemId} expenseId={item.expense_id} descricao={`${item.companhia ?? "Voo"} ${item.numero ?? ""}`} data={item.partida_utc.slice(0, 10)} pessoas={(item.passageiros ?? []).map((p) => p.person_id)} /></Autoria>
    </div>
    <AnexosItem tripId={tripId} itemTipo="ticket" itemId={itemId} podeEditar />
  </main></>;
}

function Hotel({ tripId, itemId }: { tripId: string; itemId: string }) {
  const { data: lista } = useSuspenseQuery(lodgingsQuery(tripId));
  const { data: membros } = useSuspenseQuery(membersQuery(tripId));
  const item = lista.find((x) => x.id === itemId);
  if (!item) return <p className="p-6">Hospedagem não encontrada.</p>;
  const tz = item.tz ?? fusoLocal();
  const ponto = { nome: item.nome, endereco: item.endereco, lat: item.lat, lng: item.lng, place_id: item.place_id };
  const nome = (pid: string) => membros.find((x) => x.person_id === pid)?.nome ?? "?";
  return <><Cabecalho id={tripId} titulo={item.nome} /><main className="mx-auto max-w-3xl space-y-5 px-4 pt-3">
    <AcoesTopo tipo="lodging" itemId={itemId} tripId={tripId} editarPara="/trip/$id/hospedagem/nova" queryKey={lodgingsQuery(tripId).queryKey} destaque="hosp" />
    <section className="cartao-hosp gradient-hosp shadow-medium rounded-3xl p-5 text-white">
      <p className="flex items-center gap-3 text-lg font-bold">{logoSite(item.site) ? <Logo url={logoSite(item.site)} Icone={IconeHotel} nome={item.nome} tamanho={32} /> : <IconeHotel size={26} aria-hidden />}{item.cidade ?? "Hospedagem"}</p>
      <p className="mt-2 text-2xl font-bold leading-snug">{item.endereco ?? item.nome}</p>
      <div className="mt-4 flex gap-2">
        <a href={linkGoogle(ponto)} target="_blank" rel="noopener noreferrer" className="tap flex flex-1 items-center justify-center gap-2 rounded-xl bg-white text-lg font-bold text-hosp"><Navigation size={22} /> Como chegar</a>
        {item.telefone && <a href={`tel:${item.telefone.replace(/[^\d+]/g, "")}`} className="tap flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-white text-lg font-bold text-white"><Phone size={22} /> Ligar</a>}
      </div>
    </section>
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl border border-border bg-card p-4"><small className="text-sm font-bold uppercase text-muted-foreground">Entrada</small><strong className="block text-xl">{diaCurto(item.checkin, tz)}</strong><span className="text-base text-muted-foreground">a partir de {horaNoFuso(item.checkin, tz)}</span></div>
      <div className="rounded-2xl border border-border bg-card p-4"><small className="text-sm font-bold uppercase text-muted-foreground">Saída</small><strong className="block text-xl">{diaCurto(item.checkout, tz)}</strong><span className="text-base text-muted-foreground">até {horaNoFuso(item.checkout, tz)}</span></div>
    </div>
    {(item.localizador || item.cancelamento_gratis_ate) && <section className="rounded-2xl border border-border bg-card p-4">
      <small className="text-sm font-bold uppercase text-muted-foreground">Reserva</small>
      {item.localizador && <button type="button" onClick={() => copiar(item.localizador!)} className="tap flex items-center gap-2"><span className="mono-code text-3xl font-bold">{item.localizador}</span><Copy size={22} aria-hidden /></button>}
      {item.cancelamento_gratis_ate && <span className="mt-1 inline-block rounded-full bg-ok px-3 py-1 text-base font-bold text-ok-foreground">Cancela grátis até {item.cancelamento_gratis_ate.slice(5, 10).split("-").reverse().join("/")}</span>}
    </section>}
    <section><div className="flex items-center"><h2 className="flex-1 text-2xl">Quartos · {item.quartos.length}</h2><Link to="/trip/$id/hospedagem/nova" params={{ id: tripId }} search={{ editar: itemId }} className="tap flex items-center text-lg font-bold text-accent"><Plus /> Quarto</Link></div>
      {item.quartos.map((q) => <Link key={q.id} to="/trip/$id/hospedagem/nova" params={{ id: tripId }} search={{ editar: itemId }} className="tap mt-3 flex items-center gap-3 rounded-2xl border border-border bg-card p-4"><span className="min-w-0 flex-1"><strong className="block text-lg">{[q.nome, q.tipo].filter(Boolean).join(" · ")}</strong><span className="block truncate text-base text-muted-foreground">{q.hospedes.map((g) => nome(g.person_id).split(" ")[0]).join(", ") || "Sem hóspedes"}</span></span><span className="flex -space-x-2">{q.hospedes.map((g) => <span key={g.id} title={nome(g.person_id)} className="flex size-10 items-center justify-center rounded-full border-2 border-card bg-hosp-soft text-sm font-bold text-hosp">{iniciais(nome(g.person_id))}</span>)}</span></Link>)}
    </section>
    <Autoria tipo="lodging" id={itemId}><VirarDespesa className="novo-botao tap flex w-full items-center justify-center gap-2 rounded-2xl bg-hosp text-lg font-bold text-white" tripId={tripId} tipo="lodging" itemId={itemId} expenseId={item.expense_id} descricao={item.nome} valor={item.valor} moeda={item.moeda} data={item.checkin.slice(0, 10)} pessoas={item.quartos.flatMap((q) => q.hospedes.map((g) => g.person_id))} /></Autoria>
    <AnexosItem tripId={tripId} itemTipo="lodging" itemId={itemId} podeEditar />
  </main></>;
}

function ReservaDetalhe({ tripId, itemId }: { tripId: string; itemId: string }) {
  const { data: lista } = useSuspenseQuery(reservasQuery(tripId)); const { data: membros } = useSuspenseQuery(membersQuery(tripId)); const item = lista.find((x) => x.id === itemId);
  if (!item) return <p className="p-6">Reserva não encontrada.</p>;
  return <><Cabecalho id={tripId} titulo={item.titulo} /><main className="mx-auto max-w-3xl space-y-5 px-4 pt-3"><AcoesTopo tipo="reservation" itemId={itemId} tripId={tripId} editarPara="/trip/$id/reservas/nova" queryKey={reservasQuery(tripId).queryKey} /><section className="rounded-[18px] cartao-reserva p-5 text-primary-foreground"><p className="flex min-w-0 items-center gap-3 text-xl font-bold"><CalendarDays size={28} strokeWidth={2.2} aria-hidden className="shrink-0" /><span className="min-w-0 break-words">{item.titulo}</span></p><p className="mt-1 text-lg">{dataBRCurta(chaveDia(item.inicio_utc, item.inicio_tz))}</p><p className="num mt-3 flex justify-between gap-2 text-[clamp(32px,10vw,44px)] leading-none"><span>{horaNoFuso(item.inicio_utc, item.inicio_tz)}</span>{item.fim_utc && <span className="text-right">{horaNoFuso(item.fim_utc, item.fim_tz ?? item.inicio_tz)}</span>}</p>{item.fim_utc && <p className="mt-1 text-right text-base">até {dataBRCurta(chaveDia(item.fim_utc, item.fim_tz ?? item.inicio_tz))}</p>}<p className="mt-3 text-lg">{[item.local, item.cidade].filter(Boolean).join(" · ") || "Local não informado"}</p>{item.telefone && <a href={`tel:${item.telefone.replace(/[^\d+]/g, "")}`} className="tap mt-2 inline-flex items-center gap-2 text-lg font-bold"><Phone size={22} strokeWidth={2.2} aria-hidden /> {item.telefone}</a>}{item.localizador && <button onClick={() => { void navigator.clipboard.writeText(item.localizador!); toast.success("Localizador copiado."); }} className="tap mt-2 flex items-center gap-2 text-lg font-bold">Localizador {item.localizador} <Copy size={20} aria-hidden /></button>}</section><AbrirMapa ponto={{ nome: item.titulo, endereco: [item.local, item.cidade].filter(Boolean).join(", ") || null, lat: item.lat, lng: item.lng, place_id: item.place_id }} /><section className="rounded-[18px] border border-border bg-card p-5"><p className="text-lg">Quem vai: {item.pessoas.map((p) => membros.find((x) => x.person_id === p.person_id)?.nome).filter(Boolean).join(", ") || "não informado"}</p></section><AnexosItem tripId={tripId} itemTipo="reservation" itemId={itemId} podeEditar /><Autoria tipo="reservation" id={itemId}><VirarDespesa tripId={tripId} tipo="reservation" itemId={itemId} expenseId={item.expense_id} descricao={item.titulo} valor={item.valor} moeda={item.moeda} data={item.inicio_utc.slice(0, 10)} pessoas={item.pessoas.map((p) => p.person_id)} /></Autoria></main></>;
}
/** Editar | Apagar logo abaixo do título (só para quem pode editar). */
function AcoesTopo({ tipo, itemId, tripId, editarPara, queryKey, destaque }: { destaque?: "voos" | "hosp"; tipo: "ticket" | "lodging" | "reservation"; itemId: string; tripId: string; editarPara: "/trip/$id/bilhetes/novo" | "/trip/$id/hospedagem/nova" | "/trip/$id/reservas/nova"; queryKey: readonly unknown[] }) {
  const { data } = useQuery(autoriaQuery(tipo, itemId));
  if (!data?.editar) return null;
  return <AcoesItem tripId={tripId} tabela={tipo} id={itemId} editarPara={editarPara} queryKey={queryKey as never} destaque={destaque} />;
}
