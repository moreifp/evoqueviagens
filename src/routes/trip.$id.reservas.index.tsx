import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Car, ChevronRight, Map as MapIcon, Plus, Ticket, Utensils } from "lucide-react";
import { Topo } from "@/components/Chrome";
import { CartaoResumo } from "@/components/CartaoResumo";
import { reservasQuery, roteiroQuery } from "@/lib/data";
import { chaveDia, dataBRCurta, horaNoFuso } from "@/lib/format";

export const Route = createFileRoute("/trip/$id/reservas/")({
  head: () => ({
    meta: [
      { title: "Reservas — Evoque Viagens" },
      { name: "description", content: "Carros, passeios, restaurantes e outras reservas da viagem." },
      { property: "og:title", content: "Reservas — Evoque Viagens" },
      { property: "og:description", content: "Carros, passeios, restaurantes e outras reservas da viagem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reservas,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-lg">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-lg">Sem reservas.</div>,
});

const ICONE: Record<string, typeof Car> = { carro: Car, passeio: MapIcon, restaurante: Utensils, outro: Ticket };

function Reservas() {
  const { id } = Route.useParams();
  const { data: detalhes } = useSuspenseQuery(reservasQuery(id));
  const { data: roteiro } = useSuspenseQuery(roteiroQuery(id));
  const porId = new Map(detalhes.map((r) => [r.id, r]));
  const itens = roteiro.filter((r) => r.item_tipo === "reservation");
  for (const d of detalhes)
    if (!itens.some((r) => r.item_id === d.id))
      itens.push({ item_tipo: "reservation", item_id: d.id, subtipo: d.tipo, titulo: d.titulo, inicio_utc: d.inicio_utc, inicio_tz: d.inicio_tz, fim_utc: d.fim_utc, fim_tz: d.fim_tz, cidade: d.cidade, origem_iata: null, destino_iata: null, companhia: null, numero: null, pessoas: [], detalhe: true, editar: true });
  itens.sort((a, b) => a.inicio_utc.localeCompare(b.inicio_utc));
  return (
    <>
      <Topo titulo="Reservas" voltarPara="/trip/$id" voltarParams={{ id }} />
      <main className="space-y-4 px-4 pt-4">
        {itens.length === 0 && (
          <Link to="/trip/$id/reservas/nova" params={{ id }} className="tap flex w-full items-center justify-center rounded-2xl border-2 border-dashed border-reserva-border p-8 text-lg font-bold text-reserva">+ Primeira reserva</Link>
        )}
        {itens.map((r) => {
          const d = porId.get(r.item_id);
          if (!d) return <CartaoResumo key={r.item_id} r={r} />;
          const Icone = ICONE[d.tipo] ?? Ticket;
          return (
            <Link key={d.id} to="/trip/$id/item/$tipo/$itemId" params={{ id, tipo: "reservation", itemId: d.id }} className="tap grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl cartao-reserva px-4 text-primary-foreground shadow-soft">
              <Icone size={26} strokeWidth={2.2} className="shrink-0" aria-hidden />
              <span className="min-w-0"><strong className="block truncate text-lg">{d.titulo}</strong><span className="block truncate text-sm opacity-80">{dataBRCurta(chaveDia(d.inicio_utc, d.inicio_tz))} · {horaNoFuso(d.inicio_utc, d.inicio_tz)} · {[d.local, d.cidade].filter(Boolean).join(" · ") || "Local não informado"}</span></span>
              <ChevronRight size={24} className="shrink-0" aria-hidden />
            </Link>
          );
        })}
        <Link to="/trip/$id/reservas/nova" params={{ id }} className="tap flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-accent text-xl font-bold text-accent">
          <Plus size={28} strokeWidth={2.2} />
          Nova reserva
        </Link>
      </main>
    </>
  );
}
