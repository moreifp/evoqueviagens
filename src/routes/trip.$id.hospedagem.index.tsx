import { createFileRoute, Link } from "@tanstack/react-router";
import { AcoesItem } from "@/components/AcoesItem";
import { AnexosItem } from "@/components/AnexosItem";
import { CartaoResumo } from "@/components/CartaoResumo";
import { useSuspenseQuery } from "@tanstack/react-query";
import { BedDouble, Plus } from "lucide-react";
import { Topo } from "@/components/Chrome";
import { lodgingsQuery, membersQuery, roteiroQuery } from "@/lib/data";
import { chaveDia, dataBRCurta, fmtMoney, horaNoFuso, fusoLocal } from "@/lib/format";

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
  const { data: membros } = useSuspenseQuery(membersQuery(id));
  const porId = new Map(detalhes.map((h) => [h.id, h]));
  const itens = roteiro.filter((r) => r.item_tipo === "lodging");
  // Itens recém-criados sem internet ainda podem não estar no roteiro guardado.
  for (const h of detalhes) if (!itens.some((r) => r.item_id === h.id)) itens.push({ item_tipo: "lodging", item_id: h.id, subtipo: "hotel", titulo: h.nome, inicio_utc: h.checkin, inicio_tz: "UTC", fim_utc: h.checkout, fim_tz: "UTC", cidade: h.cidade, origem_iata: null, destino_iata: null, companhia: null, numero: null, pessoas: [], detalhe: true, editar: true });
  const nome = (pid: string) => {
    const m = membros.find((x) => x.person_id === pid);
    return m ? m.apelido || m.nome : "?";
  };

  return (
    <>
      <Topo titulo="Hospedagem" voltarPara="/trip/$id" voltarParams={{ id }} />
      <main className="space-y-4 px-4 pt-4">
        {itens.length === 0 && (
          <p className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-lg font-semibold">
            Nenhuma estadia ainda
          </p>
        )}
        {itens.map((r) => {
          const h = porId.get(r.item_id);
          if (!h) return <CartaoResumo key={r.item_id} r={r} />;
          return (
          <article key={h.id} className="shadow-soft overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex gap-4 p-4">
              <BedDouble size={28} strokeWidth={2.2} className="mt-1 text-accent" />
              <div className="min-w-0 flex-1">
                <h2 className="text-xl leading-tight text-foreground">{h.nome}</h2>
                <p className="text-base font-semibold text-muted-foreground">{h.cidade ?? h.endereco}</p>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm font-bold uppercase text-muted-foreground">Entrada</p>
                    <p className="num text-2xl text-foreground">{horaNoFuso(h.checkin, fusoLocal())}</p>
                    <p className="text-base font-semibold text-foreground">{dataBRCurta(chaveDia(h.checkin))}</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold uppercase text-muted-foreground">Saída</p>
                    <p className="num text-2xl text-foreground">{horaNoFuso(h.checkout, fusoLocal())}</p>
                    <p className="text-base font-semibold text-foreground">{dataBRCurta(chaveDia(h.checkout))}</p>
                  </div>
                </div>

                {h.localizador && (
                  <p className="mono-code mt-3 text-2xl font-bold text-accent">{h.localizador}</p>
                )}
                {h.valor != null && (
                  <p className="num mt-2 text-[36px] leading-none text-foreground">
                    {fmtMoney(Number(h.valor), h.moeda ?? "BRL")}
                  </p>
                )}
              </div>
            </div>
            {h.quartos.length > 0 && (
              <ul className="space-y-2 border-t border-border p-4">
                {h.quartos.map((q) => (
                  <li key={q.id} className="text-lg">
                    <span className="font-bold">{q.nome}</span>
                    {q.tipo ? <span className="text-muted-foreground"> · {q.tipo}</span> : null}
                    <span className="block text-foreground">{q.hospedes.map((g) => nome(g.person_id)).join(", ") || "Sem hóspedes"}</span>
                  </li>
                ))}
              </ul>
            )}
            <AnexosItem tripId={id} itemTipo="lodging" itemId={h.id} podeEditar={r.editar} />
            {r.editar && <AcoesItem tabela="lodging" id={h.id} tripId={id} editarPara="/trip/$id/hospedagem/nova" queryKey={lodgingsQuery(id).queryKey} />}
          </article>
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
