import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Topo } from "@/components/Chrome";
import { FormBilhete } from "@/components/FormBilhete";
import { MesmoVoo } from "@/components/MesmoVoo";
import { membersQuery, ticketsQuery } from "@/lib/data";

type Busca = { editar?: string; copiar?: string; para?: string; pax?: string };
const str = (s: Record<string, unknown>, k: string) =>
  typeof s[k] === "string" ? { [k]: s[k] as string } : {};

export const Route = createFileRoute("/trip/$id/bilhetes/novo")({
  validateSearch: (s: Record<string, unknown>): Busca => ({
    ...str(s, "editar"),
    ...str(s, "copiar"),
    ...str(s, "para"),
    ...str(s, "pax"),
  }),
  head: () => ({
    meta: [
      { title: "Bilhete — Evoque Viagens" },
      {
        name: "description",
        content:
          "Cadastre ou edite voo, trem, ônibus ou transfer com passageiros e fuso automático.",
      },
      { property: "og:title", content: "Bilhete — Evoque Viagens" },
      {
        property: "og:description",
        content:
          "Cadastre ou edite voo, trem, ônibus ou transfer com passageiros e fuso automático.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TelaBilhete,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-lg">
      {(error as Error).message}
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-lg">Bilhete não encontrado.</div>,
});

function TelaBilhete() {
  const { id } = Route.useParams();
  const { editar, copiar, para, pax } = Route.useSearch();
  const navigate = useNavigate();
  const { data: bilhetes } = useSuspenseQuery(ticketsQuery(id));
  useSuspenseQuery(membersQuery(id));
  const voltar = () =>
    navigate({
      to: "/trip/$id/bilhetes",
      params: { id },
      search: para || pax ? { p: para ?? pax } : {},
    });

  // Editar só os dados de uma pessoa neste voo.
  if (editar && pax)
    return (
      <>
        <Topo titulo="Dados no voo" voltarPara="/trip/$id/bilhetes" voltarParams={{ id }} />
        <MesmoVoo tripId={id} pid={pax} iniciais={[editar]} fixo onFeito={voltar} />
      </>
    );

  const inicial = editar ? bilhetes.find((b) => b.id === editar) : undefined;
  const modelo = copiar ? bilhetes.find((b) => b.id === copiar) : undefined;
  if (editar && !inicial) return <p className="p-6 text-lg">Você não pode editar este bilhete.</p>;
  return (
    <>
      <Topo
        titulo={inicial ? "Editar bilhete" : "Novo bilhete"}
        voltarPara="/trip/$id/bilhetes"
        voltarParams={{ id }}
      />
      {modo === "pergunta" && (
        <div className="space-y-4 px-4 pt-6">
          <h2 className="text-[28px] font-bold leading-tight">Mesmo voo de {nomeDono}?</h2>
          <button
            onClick={() => setModo("mesmo")}
            className="gradient-hero shadow-medium tap flex min-h-[72px] w-full items-center justify-center gap-3 rounded-2xl text-xl font-bold"
          >
            <Users size={28} strokeWidth={2.2} /> Sim, mesmo voo
          </button>
          <button
            onClick={() => setModo("outro")}
            className="tap flex min-h-[72px] w-full items-center justify-center gap-3 rounded-2xl border-2 border-primary text-xl font-bold text-foreground"
          >
            <Plane size={28} strokeWidth={2.2} /> Não, outro voo
          </button>
        </div>
      )}
      {para && (modo === "mesmo" || casado) && (
        <MesmoVoo
          key={casado?.ids.join() ?? "sel"}
          tripId={id}
          pid={para}
          iniciais={casado?.ids}
          lido={casado?.lido}
          onFeito={voltar}
        />
      )}
      {modo === "outro" && !casado && (
        <FormBilhete
          key={editar ?? copiar ?? "novo"}
          tripId={id}
          inicial={inicial}
          copiarDe={modelo}
          para={para}
          onMesmoVoo={para ? (tid, lido) => setCasado({ ids: [tid], lido }) : undefined}
        />
      )}
    </>
  );
}
