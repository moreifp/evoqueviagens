import { createFileRoute, Link } from "@tanstack/react-router";
import { AcoesItem } from "@/components/AcoesItem";
import { AnexosItem } from "@/components/AnexosItem";
import { CartaoResumo } from "@/components/CartaoResumo";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { StatusVoo } from "@/components/StatusVoo";
import type { StatusVoo as StatusVooT } from "@/lib/voo";
import { useState } from "react";
import { Plane, TrainFront, Bus, Car, Plus, ChevronDown } from "lucide-react";
import { Topo } from "@/components/Chrome";
import { Logo } from "@/components/Logo";
import { logoCia } from "@/lib/logos";
import { flightStatusQuery, membersQuery, roteiroQuery, ticketsQuery, type ItemRoteiro, type Ticket } from "@/lib/data";
import { chaveDia, dataBRCurta, horaNoFuso, fusoLocal, nomeFusoCurto } from "@/lib/format";

export const Route = createFileRoute("/trip/$id/bilhetes/")({
  head: () => ({
    meta: [
      { title: "Bilhetes — Evoque Viagens" },
      { name: "description", content: "Cartões de embarque da viagem, agrupados por dia." },
      { property: "og:title", content: "Bilhetes" },
      { property: "og:description", content: "Cartões de embarque da viagem, agrupados por dia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Bilhetes,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-lg">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-lg">Sem bilhetes.</div>,
});

const ICONE: Record<string, typeof Plane> = {
  voo: Plane,
  trem: TrainFront,
  onibus: Bus,
  carro: Car,
  transfer: Car,
};

function Bilhetes() {
  const { id } = Route.useParams();
  const { data: detalhes } = useSuspenseQuery(ticketsQuery(id));
  const { data: roteiro } = useSuspenseQuery(roteiroQuery(id));
  const { data: membros } = useSuspenseQuery(membersQuery(id));
  const { data: status } = useQuery(flightStatusQuery(id));
  const porId = new Map(detalhes.map((b) => [b.id, b]));
  const itens = roteiro.filter((r) => r.item_tipo === "ticket");
  for (const b of detalhes)
    if (!itens.some((r) => r.item_id === b.id))
      itens.push({ item_tipo: "ticket", item_id: b.id, subtipo: b.tipo, titulo: "", inicio_utc: b.partida_utc, inicio_tz: b.partida_tz, fim_utc: b.chegada_utc, fim_tz: b.chegada_tz, cidade: null, origem_iata: null, destino_iata: null, companhia: null, numero: null, pessoas: [], detalhe: true, editar: true });
  itens.sort((a, b) => a.inicio_utc.localeCompare(b.inicio_utc));
  const bilhetes = itens;
  const nome = (pid: string) => {
    const m = membros.find((x) => x.person_id === pid);
    return m ? m.apelido || m.nome : "?";
  };

  const grupos = new Map<string, ItemRoteiro[]>();
  for (const b of itens) {
    const dia = chaveDia(b.inicio_utc, b.inicio_tz);
    grupos.set(dia, [...(grupos.get(dia) ?? []), b]);
  }

  return (
    <>
      <Topo titulo="Bilhetes" voltarPara="/trip/$id" voltarParams={{ id }} />
      <main className="space-y-6 px-4 pt-4">
        {bilhetes.length === 0 && (
          <p className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-lg font-semibold">
            Nenhum bilhete ainda
          </p>
        )}
        {[...grupos.entries()].map(([dia, itens]) => (
          <section key={dia}>
            <h2 className="text-base font-bold uppercase tracking-wide text-muted-foreground">
              {dataBRCurta(dia)}
            </h2>
            <div className="mt-2 space-y-3">
              {itens.map((r) => {
                const b = porId.get(r.item_id);
                return b ? <CartaoEmbarque key={r.item_id} b={b} s={status?.[b.id]} editar={r.editar} nome={nome} /> : <CartaoResumo key={r.item_id} r={r} />;
              })}
            </div>
          </section>
        ))}

        <Link
          to="/trip/$id/bilhetes/novo"
          params={{ id }}
          className="tap flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-accent text-xl font-bold text-accent"
        >
          <Plus size={28} strokeWidth={2.2} />
          Novo bilhete
        </Link>
      </main>
    </>
  );
}

function CartaoEmbarque({ b, s, editar, nome }: { b: Ticket; s?: StatusVooT; editar: boolean; nome: (pid: string) => string }) {
  const [aberto, setAberto] = useState(false);
  const Icone = ICONE[b.tipo] ?? Plane;
  const [hh, mm] = horaNoFuso(b.partida_utc, b.partida_tz).split(":");
  return (
    <article className="shadow-soft overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-start gap-4 p-4">
        <Icone size={28} strokeWidth={2.2} className="mt-1 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="num text-[36px] leading-none text-foreground">
            {hh}
            <span className="text-muted-foreground">:</span>
            {mm}
          </p>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {nomeFusoCurto(b.partida_tz)} · {horaNoFuso(b.partida_utc, fusoLocal())} no seu horário
          </p>
          <p className="mt-2 text-xl font-bold text-foreground">
            {b.origem_iata ?? b.origem_cidade ?? "?"} → {b.destino_iata ?? b.destino_cidade ?? "?"}
          </p>
          <p className="mono-code mt-2 flex items-center gap-3 text-2xl font-bold text-foreground">
            {b.tipo === "voo" && <Logo url={logoCia(b.companhia, b.numero)} Icone={Plane} nome={b.companhia ?? "companhia"} tamanho={32} className="text-accent" />}
            {[b.companhia, b.numero].filter(Boolean).join(" ")}
          </p>
          {b.localizador && (
            <p className="mono-code text-2xl font-bold text-accent">{b.localizador}</p>
          )}
          <p className="mt-2 text-base font-semibold text-muted-foreground">
            Chega {horaNoFuso(b.chegada_utc, b.chegada_tz)} · {dataBRCurta(chaveDia(b.chegada_utc, b.chegada_tz))}
          </p>
        </div>
      </div>

      <StatusVoo b={b} s={s} />

      {b.passageiros.length > 0 && (
        <ul className="space-y-2 border-t border-border p-4">
          {b.passageiros.map((p) => (
            <li key={p.id} className="flex items-baseline justify-between gap-3 text-lg">
              <span className="font-bold text-foreground">{nome(p.person_id)}</span>
              <span className="mono-code text-xl font-bold text-accent">{p.assento ?? "—"}</span>
            </li>
          ))}
        </ul>
      )}
      <AnexosItem tripId={b.trip_id} itemTipo="ticket" itemId={b.id} podeEditar={editar} />
      {editar && <AcoesItem tabela="ticket" id={b.id} tripId={b.trip_id} editarPara="/trip/$id/bilhetes/novo" queryKey={ticketsQuery(b.trip_id).queryKey} />}

      <Link
        to="/trip/$id/item/$tipo/$itemId"
        params={{ id: b.trip_id, tipo: "ticket", itemId: b.id }}
        className="tap flex w-full items-center justify-center gap-2 border-t border-border text-lg font-bold text-accent"
      >
        Abrir {b.tipo === "voo" ? "voo" : "trecho"}
      </Link>
      <button
        onClick={() => setAberto((a) => !a)}
        className="tap flex w-full items-center justify-center gap-2 border-t border-border text-base font-bold text-muted-foreground"
      >
        <ChevronDown size={26} strokeWidth={2.2} className={aberto ? "rotate-180" : ""} />
        Detalhes
      </button>
      {aberto && (
        <dl className="space-y-2 border-t border-border p-4 text-base">
          {b.passageiros.map((p) => (
            <Linha key={p.id} rotulo={nome(p.person_id)} valor={[p.nome_no_bilhete, p.eticket && `e-ticket ${p.eticket}`].filter(Boolean).join(" · ") || null} />
          ))}
          <Linha rotulo="Saída" valor={b.origem_cidade} />
          <Linha rotulo="Destino" valor={b.destino_cidade} />
        </dl>
      )}
    </article>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="font-semibold text-muted-foreground">{rotulo}</dt>
      <dd className="font-bold text-foreground">{valor}</dd>
    </div>
  );
}
