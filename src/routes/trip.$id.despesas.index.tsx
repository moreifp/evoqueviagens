import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Topo } from "@/components/Chrome";
import { expensesQuery, membersQuery, tripQuery } from "@/lib/data";
import { dataBRCurta, fmtMoney } from "@/lib/format";
import { CATEGORIAS } from "@/lib/categorias";
import { EditarItem } from "@/components/EditarItem";
import { EditarMoedaDespesa } from "@/components/EditarMoedaDespesa";

export const Route = createFileRoute("/trip/$id/despesas/")({
  head: () => ({
    meta: [
      { title: "Dinheiro — Evoque Viagens" },
      { name: "description", content: "Gastos da viagem por dia, na moeda da viagem." },
      { property: "og:title", content: "Dinheiro" },
      { property: "og:description", content: "Gastos da viagem por dia, na moeda da viagem." },
    ],
  }),
  component: Lista,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-lg">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-lg">Sem despesas.</div>,
});


function Lista() {
  const { id } = Route.useParams();
  const { data: trip } = useSuspenseQuery(tripQuery(id));
  const { data: despesas } = useSuspenseQuery(expensesQuery(id));
  const { data: membros } = useSuspenseQuery(membersQuery(id));
  const [cat, setCat] = useState("todas");
  const [quem, setQuem] = useState("todos");

  const filtradas = despesas.filter(
    (d) => (cat === "todas" || d.categoria === cat) && (quem === "todos" || d.pago_por === quem),
  );
  const total = filtradas.reduce((s, d) => s + Number(d.valor_moeda_base), 0);

  const dias = new Map<string, typeof filtradas>();
  for (const d of filtradas) dias.set(d.data, [...(dias.get(d.data) ?? []), d]);

  return (
    <>
      <Topo titulo="Dinheiro" voltarPara="/trip/$id" voltarParams={{ id }} />
      <main className="space-y-5 px-4 pt-4">
        <section className="gradient-hero shadow-medium rounded-3xl p-5">
          <p className="text-sm font-bold uppercase tracking-wide opacity-90">Total da viagem</p>
          <p className="num mt-1 text-[42px] leading-none">{fmtMoney(total, trip.moeda_base)}</p>
        </section>

        <div className="flex gap-3">
          <select
            aria-label="Categoria"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="tap flex-1 rounded-xl border-2 border-input bg-card px-3 text-base font-bold text-foreground"
          >
            <option value="todas">Toda categoria</option>
            {CATEGORIAS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.rotulo}
              </option>
            ))}
          </select>
          <select
            aria-label="Pessoa"
            value={quem}
            onChange={(e) => setQuem(e.target.value)}
            className="tap flex-1 rounded-xl border-2 border-input bg-card px-3 text-base font-bold text-foreground"
          >
            <option value="todos">Todas pessoas</option>
            {membros.map((m) => (
              <option key={m.person_id} value={m.person_id}>
                {m.apelido || m.nome}
              </option>
            ))}
          </select>
        </div>

        {filtradas.length === 0 && (
          <p className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-lg font-semibold">
            Nenhum gasto ainda
          </p>
        )}

        {[...dias.entries()].map(([dia, itens]) => (
          <section key={dia}>
            <h2 className="text-base font-bold uppercase tracking-wide text-muted-foreground">
              {dataBRCurta(dia)}
            </h2>
            <ul className="mt-2 space-y-2">
              {itens.map((d) => {
                const c = CATEGORIAS.find((x) => x.id === d.categoria);
                const Icone = c?.Icone;
                return (
                  <li key={d.id} className="shadow-soft overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="flex items-center gap-3 p-3">
                    {Icone && <Icone size={28} strokeWidth={2.2} className="text-accent" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-bold text-foreground">{d.descricao}</p>
                      {d.moeda_original !== trip.moeda_base && (
                        <p className="text-sm font-semibold text-muted-foreground">
                          {fmtMoney(Number(d.valor_original), d.moeda_original)} · taxa {String(d.taxa_cambio).replace(".", ",")}{(d as { taxa_fonte?: string | null }).taxa_fonte ? ` · ${(d as { taxa_fonte?: string }).taxa_fonte}${(d as { taxa_data?: string | null }).taxa_data ? ` · ${dataBRCurta(String((d as { taxa_data?: string | null }).taxa_data))}` : ""}` : ""}
                        </p>
                      )}
                    </div>
                    <p className="num shrink-0 text-2xl text-foreground">
                      {fmtMoney(Number(d.valor_moeda_base), trip.moeda_base)}
                    </p>
                  </div>
                  <EditarItem
                    tabela="expense"
                    item={d as unknown as { id: string } & Record<string, unknown>}
                    queryKey={expensesQuery(id).queryKey}
                    campos={[{ chave: "descricao", rotulo: "Descrição" }, { chave: "valor_original", rotulo: `Valor (${d.moeda_original})`, tipo: "number" }]}
                    ajustar={(v, it) => (v.valor_original != null ? { ...v, valor_moeda_base: Math.round(Number(v.valor_original) * Number(it.taxa_cambio) * 100) / 100, editado_em: new Date().toISOString() } : { ...v, editado_em: new Date().toISOString() })}
                  />
                  <EditarMoedaDespesa d={d as never} moedaBase={trip.moeda_base} queryKey={expensesQuery(id).queryKey} />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>
    </>
  );
}
