import { createFileRoute, Link } from "@tanstack/react-router";
import { EditarItem } from "@/components/EditarItem";
import { abrirAnexo } from "@/lib/anexosOffline";
import { toast } from "sonner";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { StatusVoo } from "@/components/StatusVoo";
import type { StatusVoo as StatusVooT } from "@/lib/voo";
import { useState } from "react";
import { Plane, TrainFront, Bus, Car, FileText, Plus, ChevronDown } from "lucide-react";
import { Topo } from "@/components/Chrome";
import { flightStatusQuery, ticketsQuery, type Ticket } from "@/lib/data";
import { chaveDia, dataBRCurta, horaNoFuso, fusoLocal, nomeFusoCurto } from "@/lib/format";

export const Route = createFileRoute("/trip/$id/bilhetes/")({
  head: () => ({
    meta: [
      { title: "Bilhetes — Evoque Viagens" },
      { name: "description", content: "Cartões de embarque da viagem, agrupados por dia." },
      { property: "og:title", content: "Bilhetes" },
      { property: "og:description", content: "Cartões de embarque da viagem, agrupados por dia." },
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
  const { data: bilhetes } = useSuspenseQuery(ticketsQuery(id));
  const { data: status } = useQuery(flightStatusQuery(id));

  const grupos = new Map<string, Ticket[]>();
  for (const b of bilhetes) {
    const dia = chaveDia(b.partida_utc, b.partida_tz);
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
              {itens.map((b) => (
                <CartaoEmbarque key={b.id} b={b} s={status?.[b.id]} />
              ))}
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

function CartaoEmbarque({ b, s }: { b: Ticket; s?: StatusVooT }) {
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
          <p className="mono-code mt-2 text-2xl font-bold text-foreground">
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

      {b.anexo_url && (
        <button
          onClick={() => void abrirAnexo(b.anexo_url!).then((ok) => !ok && toast.error("Sem internet e sem cópia guardada deste arquivo."))}
          className="tap flex w-full items-center justify-center gap-3 border-t border-border bg-muted text-lg font-bold text-foreground"
        >
          <FileText size={28} strokeWidth={2.2} />
          Ver documento
        </button>
      )}
      <EditarItem
        tabela="ticket"
        item={b as unknown as { id: string } & Record<string, unknown>}
        queryKey={ticketsQuery(b.trip_id).queryKey}
        campos={[{ chave: "localizador", rotulo: "Localizador" }, { chave: "assento", rotulo: "Assento" }, { chave: "nome_no_bilhete", rotulo: "Passageiro" }]}
      />

      <button
        onClick={() => setAberto((a) => !a)}
        className="tap flex w-full items-center justify-center gap-2 border-t border-border text-base font-bold text-muted-foreground"
      >
        <ChevronDown size={26} strokeWidth={2.2} className={aberto ? "rotate-180" : ""} />
        Detalhes
      </button>
      {aberto && (
        <dl className="space-y-2 border-t border-border p-4 text-base">
          <Linha rotulo="Assento" valor={b.assento} />
          <Linha rotulo="Passageiro" valor={b.nome_no_bilhete} />
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
