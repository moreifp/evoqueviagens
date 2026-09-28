import { createFileRoute, Link } from "@tanstack/react-router";
import { CartaoResumo } from "@/components/CartaoResumo";
import { useSuspenseQuery } from "@tanstack/react-query";
import { BedDouble, ChevronRight, Plus } from "lucide-react";
import { Topo } from "@/components/Chrome";
import { lodgingsQuery, roteiroQuery } from "@/lib/data";
import { chaveDia, dataBRCurta } from "@/lib/format";

export const Route = createFileRoute("/trip/$id/hospedagem/")({
  head: () => ({
    meta: [
      { title: "Hospedagem — Evoque Viagens" },
      { name: "description", content: "Estadias da viagem com entrada, saída e localizador." },
      { property: "og:title", content: "Hospedagem" },
      { property: "og:description", content: "Estadias da viagem com entrada, saída e localizador." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Hospedagem,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-lg">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-lg">Sem hospedagem.</div>,
});

function Hospedagem() {
  const { id } = Route.useParams();
  const { data: detalhes } = useSuspenseQuery(lodgingsQuery(id));
  const { data: roteiro } = useSuspenseQuery(roteiroQuery(id));
  const porId = new Map(detalhes.map((h) => [h.id, h]));
  const itens = roteiro.filter((r) => r.item_tipo === "lodging");
  // Itens recém-criados sem internet ainda podem não estar no roteiro guardado.
  for (const h of detalhes) if (!itens.some((r) => r.item_id === h.id)) itens.push({ item_tipo: "lodging", item_id: h.id, subtipo: "hotel", titulo: h.nome, inicio_utc: h.checkin, inicio_tz: "UTC", fim_utc: h.checkout, fim_tz: "UTC", cidade: h.cidade, origem_iata: null, destino_iata: null, companhia: null, numero: null, pessoas: [], detalhe: true, editar: true });
  return (
    <>
      <Topo titulo="Hospedagem" voltarPara="/trip/$id" voltarParams={{ id }} />
      <main className="space-y-4 px-4 pt-4">
        {itens.length === 0 && (
          <Link to="/trip/$id/hospedagem/nova" params={{ id }} className="tap flex w-full items-center justify-center rounded-2xl border-2 border-dashed border-hosp-border p-8 text-lg font-bold text-hosp">+ Primeira estadia</Link>
        )}
        {itens.map((r) => {
          const h = porId.get(r.item_id);
          if (!h) return <CartaoResumo key={r.item_id} r={r} />;
          return (
          <Link key={h.id} to="/trip/$id/item/$tipo/$itemId" params={{ id, tipo: "lodging", itemId: h.id }} className="tap grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl cartao-hosp px-4 text-primary-foreground shadow-soft">
            <BedDouble size={26} strokeWidth={2.2} className="shrink-0" aria-hidden />
            <span className="min-w-0"><strong className="block truncate text-lg">{h.nome}</strong><span className="block truncate text-sm opacity-80">{dataBRCurta(chaveDia(h.checkin))}–{dataBRCurta(chaveDia(h.checkout))} · {h.cidade ?? h.endereco ?? "Local não informado"}</span></span>
            <ChevronRight size={24} className="shrink-0" aria-hidden />
          </Link>
          );
        })}

        <Link
          to="/trip/$id/hospedagem/nova"
          params={{ id }}
          className="tap flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-accent text-xl font-bold text-accent"
        >
          <Plus size={28} strokeWidth={2.2} />
          Nova estadia
        </Link>
      </main>
    </>
  );
}
