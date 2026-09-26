import { AvisosMeus } from "./AvisosPedidos";
import { Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BedDouble, CalendarCheck, Copy, MessageSquareWarning, Plane, Plus } from "lucide-react";
import { membersQuery, roteiroQuery, ticketsQuery, pedidosQuery, type Trip, type ItemRoteiro } from "@/lib/data";
import { chaveDia, dataBRCurta, horaNoFuso } from "@/lib/format";
import { AvatarGrupo } from "@/components/AvatarGrupo";
import { SeloOffline } from "@/components/SeloOffline";
import { CartaoEmergencia } from "@/components/CartaoEmergencia";
import { mutar } from "@/lib/outbox";
import { aviso, naTela, novoId } from "@/lib/itens";
import { supabase } from "@/integrations/supabase/client";

export function VisaoParticipante({ trip }: { trip: Trip }) {
  const id = trip.id;
  const qc = useQueryClient();
  const { data: roteiro } = useSuspenseQuery(roteiroQuery(id));
  const { data: membros } = useSuspenseQuery(membersQuery(id));
  const { data: bilhetes = [] } = useQuery(ticketsQuery(id));
  const [pedido, setPedido] = useState("");
  const meus = new Set(membros.filter((m) => m.meu || m.kind === "dependent").map((m) => m.person_id));
  const dono = membros.find((m) => m.papel === "owner");
  const agora = new Date().toISOString();
  const meusItens = roteiro.filter((r) => r.detalhe && (r.pessoas.some((p) => meus.has(p.id)) || r.editar));
  const proximo = meusItens.find((r) => r.inicio_utc >= agora);
  const bilhete = proximo?.item_tipo === "ticket" ? bilhetes.find((b) => b.id === proximo.item_id) : undefined;
  const assento = bilhete?.passageiros.find((p) => meus.has(p.person_id))?.assento;
  const localizador = bilhete?.localizador;
  const porDia = roteiro.reduce<Record<string, ItemRoteiro[]>>((acc, item) => { (acc[chaveDia(item.inicio_utc, item.inicio_tz)] ??= []).push(item); return acc; }, {});
  const minhaPessoa = membros.find((m) => m.meu)?.person_id;

  async function pedir() {
    const msg = pedido.trim();
    if (!msg || !minhaPessoa) return;
    const { data } = await supabase.auth.getSession();
    const row = { id: novoId(), trip_id: id, person_id: minhaPessoa, tipo: "pedido_correcao", mensagem: msg.slice(0, 500), enviado_por: data.session?.user.id, canal: "app" };
    try {
      const r = await mutar({ tipo: "insert", tabela: "trip_notice", valores: row });
      naTela(qc, pedidosQuery(id).queryKey, (l) => [{ ...row, enviado_em: new Date().toISOString(), resolvido_em: null }, ...l]);
      setPedido("");
      toast.success(aviso(r, `Pedido enviado a ${dono?.nome ?? "quem organiza"}`));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <header className="flex items-center gap-3 px-4 py-3"><Link to="/viagens" className="tap flex items-center text-lg font-bold">Voltar</Link><div className="min-w-0 flex-1"><h1 className="truncate text-2xl">{trip.nome}</h1><p className="text-base text-muted-foreground">{dataBRCurta(trip.data_inicio)} a {dataBRCurta(trip.data_fim)} · {dono?.nome ?? "Outra pessoa"} organiza</p></div></header>
      <main className="mx-auto max-w-3xl space-y-5 px-4 pt-3 pb-28">
        <SeloOffline tripId={id} />
        <CartaoEmergencia trip={trip} editavel={false} />
        {proximo ? (
          <Link to="/trip/$id/item/$tipo/$itemId" params={{ id, tipo: proximo.item_tipo, itemId: proximo.item_id }} className="gradient-hero shadow-medium block rounded-3xl p-6">
            <p className="text-sm font-bold uppercase tracking-wide">Seu próximo</p>
            <h2 className="mt-1 text-2xl">{proximo.titulo}</h2>
            <p className="num mt-3 text-[44px] leading-none">{horaNoFuso(proximo.inicio_utc, proximo.inicio_tz)}</p>
            <p className="mt-2 text-lg font-semibold">{dataBRCurta(chaveDia(proximo.inicio_utc, proximo.inicio_tz))}{proximo.companhia ? ` · ${proximo.companhia} ${proximo.numero ?? ""}` : ""}{assento ? ` · assento ${assento}` : ""}</p>
          </Link>
        ) : <div className="gradient-hero shadow-medium rounded-3xl p-6"><h2 className="text-2xl">Nada no seu nome ainda</h2></div>}
        {localizador && <button onClick={() => { void navigator.clipboard.writeText(localizador); toast.success("Localizador copiado."); }} className="tap flex items-center gap-2 text-lg font-bold text-accent">Localizador {localizador} <Copy size={22} /></button>}

        <AvisosMeus tripId={trip.id} />
        <section><h2 className="mb-2 text-2xl">O que é seu</h2>
          <div className="divide-y divide-border rounded-[18px] border border-border bg-card">
            {meusItens.length === 0 && <p className="p-4 text-lg">Nenhum voo, quarto ou reserva no seu nome.</p>}
            {meusItens.map((r) => { const I = r.item_tipo === "ticket" ? Plane : r.item_tipo === "lodging" ? BedDouble : CalendarCheck; return (
              <Link key={r.item_id} to="/trip/$id/item/$tipo/$itemId" params={{ id, tipo: r.item_tipo, itemId: r.item_id }} className="tap flex items-center gap-3 px-4 py-2"><I size={26} strokeWidth={2.2} className="text-accent" /><span className="min-w-0 flex-1"><strong className="block truncate text-lg">{r.titulo}</strong><span className="text-base text-muted-foreground">{dataBRCurta(chaveDia(r.inicio_utc, r.inicio_tz))} · {horaNoFuso(r.inicio_utc, r.inicio_tz)}</span></span></Link>
            ); })}
          </div>
        </section>

        <Link to="/trip/$id/adicionar" params={{ id }} className="tap flex w-full items-center gap-3 rounded-[18px] border-2 border-accent bg-card px-4 py-3 text-left"><Plus size={28} strokeWidth={2.2} className="shrink-0 text-accent" /><span><strong className="block text-xl text-accent">Adicionar meu voo ou reserva</strong><span className="text-base">Comprou por fora? Coloque aqui.</span></span></Link>

        <section><h2 className="mb-2 text-2xl">A viagem</h2>
          {Object.entries(porDia).map(([dia, itens]) => <div key={dia} className="mb-3"><h3 className="mb-1 text-lg font-extrabold uppercase">{dataBRCurta(dia)}</h3><div className="divide-y divide-border rounded-[18px] border border-border bg-card">{itens.map((i) => <div key={i.item_id} className="flex min-h-14 items-center gap-3 px-4"><strong className="num w-16 text-lg">{horaNoFuso(i.inicio_utc, i.inicio_tz)}</strong><span className="min-w-0 flex-1"><span className="block truncate text-lg font-bold">{i.titulo}</span><span className="text-base text-muted-foreground">{i.pessoas.map((p) => p.nome).join(", ")}</span></span></div>)}</div></div>)}
        </section>

        <section className="rounded-[18px] border border-border bg-card p-4"><h2 className="text-2xl">Quem vai</h2><div className="mt-3"><AvatarGrupo nomes={membros.filter((m) => m.status === "aceito").map((m) => m.apelido || m.nome)} /></div><p className="mt-3 text-lg">Você vê nomes e horários. Documentos de cada um, só o organizador vê.</p></section>

        <section className="space-y-3 rounded-[18px] border border-border bg-card p-4"><h2 className="flex items-center gap-2 text-2xl"><MessageSquareWarning size={26} /> Pedir correção ao organizador</h2>
          <textarea value={pedido} onChange={(e) => setPedido(e.target.value)} maxLength={500} rows={3} placeholder="Ex.: meu assento é 14C, não 14D" className="w-full rounded-lg border border-border bg-background p-3 text-lg" />
          <button onClick={() => void pedir()} disabled={!pedido.trim()} className="tap w-full rounded-[18px] bg-primary text-lg font-bold text-primary-foreground">Enviar pedido</button>
        </section>
      </main>
    </>
  );
}
