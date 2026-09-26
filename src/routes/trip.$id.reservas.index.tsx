import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Car, Map as MapIcon, Phone, Plus, Ticket, Utensils } from "lucide-react";
import { Topo } from "@/components/Chrome";
import { AcoesItem } from "@/components/AcoesItem";
import { AnexosItem } from "@/components/AnexosItem";
import { CartaoResumo } from "@/components/CartaoResumo";
import { membersQuery, reservasQuery, roteiroQuery } from "@/lib/data";
import { chaveDia, dataBRCurta, fmtMoney, horaNoFuso } from "@/lib/format";

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
  const { data: membros } = useSuspenseQuery(membersQuery(id));
  const porId = new Map(detalhes.map((r) => [r.id, r]));
  const itens = roteiro.filter((r) => r.item_tipo === "reservation");
  for (const d of detalhes)
    if (!itens.some((r) => r.item_id === d.id))
      itens.push({ item_tipo: "reservation", item_id: d.id, subtipo: d.tipo, titulo: d.titulo, inicio_utc: d.inicio_utc, inicio_tz: d.inicio_tz, fim_utc: d.fim_utc, fim_tz: d.fim_tz, cidade: d.cidade, origem_iata: null, destino_iata: null, companhia: null, numero: null, pessoas: [], detalhe: true, editar: true });
  itens.sort((a, b) => a.inicio_utc.localeCompare(b.inicio_utc));
  const nome = (pid: string) => {
    const m = membros.find((x) => x.person_id === pid);
    return m ? m.apelido || m.nome : "?";
  };

  return (
    <>
      <Topo titulo="Reservas" voltarPara="/trip/$id" voltarParams={{ id }} />
      <main className="space-y-4 px-4 pt-4">
        {itens.length === 0 && (
          <p className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-lg font-semibold">Nenhuma reserva ainda</p>
        )}
        {itens.map((r) => {
          const d = porId.get(r.item_id);
          if (!d) return <CartaoResumo key={r.item_id} r={r} />;
          const Icone = ICONE[d.tipo] ?? Ticket;
          return (
            <article key={d.id} className="shadow-soft overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex gap-4 p-4">
                <Icone size={28} strokeWidth={2.2} className="mt-1 text-accent" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl leading-tight text-foreground">{d.titulo}</h2>
                  <p className="text-lg font-semibold text-muted-foreground">
                    {dataBRCurta(chaveDia(d.inicio_utc, d.inicio_tz))} · {horaNoFuso(d.inicio_utc, d.inicio_tz)}
                    {d.fim_utc ? ` até ${dataBRCurta(chaveDia(d.fim_utc, d.fim_tz ?? d.inicio_tz))} ${horaNoFuso(d.fim_utc, d.fim_tz ?? d.inicio_tz)}` : ""}
                  </p>
                  {(d.local || d.cidade) && <p className="text-lg text-foreground">{[d.local, d.cidade].filter(Boolean).join(" · ")}</p>}
                  {d.localizador && <p className="mono-code mt-2 text-2xl font-bold text-accent">{d.localizador}</p>}
                  {d.valor != null && <p className="num mt-2 text-[36px] leading-none text-foreground">{fmtMoney(Number(d.valor), d.moeda ?? "BRL")}</p>}
                  {d.pessoas.length > 0 && (
                    <p className="mt-2 text-lg text-foreground">
                      Vão: {d.pessoas.map((p) => `${nome(p.person_id)}${p.papel ? ` (${p.papel})` : ""}`).join(", ")}
                    </p>
                  )}
                </div>
              </div>
              <AnexosItem tripId={id} itemTipo="reservation" itemId={d.id} podeEditar={r.editar} />
              <Link to="/trip/$id/item/$tipo/$itemId" params={{ id, tipo: "reservation", itemId: d.id }} className="tap flex w-full items-center justify-center border-t border-border text-lg font-bold text-accent">Abrir reserva</Link>
              {r.editar && <AcoesItem tabela="reservation" id={d.id} tripId={id} editarPara="/trip/$id/reservas/nova" queryKey={reservasQuery(id).queryKey} />}
            </article>
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
