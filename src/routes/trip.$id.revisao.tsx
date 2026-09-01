import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleAlert, TriangleAlert, Lightbulb, ShieldCheck, Plane, BedDouble, CalendarDays } from "lucide-react";
import { Topo } from "@/components/Chrome";
import { useAuditoria, useDispensar } from "@/lib/auditoria";
import type { Achado, ItemRef } from "@/lib/audit";

export const Route = createFileRoute("/trip/$id/revisao")({
  head: () => ({
    meta: [
      { title: "Revisão da viagem — Evoque Viagens" },
      { name: "description", content: "Conferência automática de datas, hotéis e bilhetes." },
      { property: "og:title", content: "Revisão da viagem" },
      { property: "og:description", content: "Conferência automática de datas, hotéis e bilhetes." },
    ],
  }),
  component: Revisao,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-lg">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-lg">Nada para revisar.</div>,
});

function Revisao() {
  const { id } = Route.useParams();
  const { visiveis } = useAuditoria(id);
  const dispensar = useDispensar(id);

  return (
    <>
      <Topo titulo="Revisão" voltarPara="/trip/$id" voltarParams={{ id }} />
      <main className="space-y-4 px-4 pt-4">
        {visiveis.length === 0 ? (
          <section className="flex flex-col items-center gap-4 rounded-3xl bg-muted px-6 py-16 text-center">
            <ShieldCheck size={56} strokeWidth={2.2} className="text-ok" />
            <p className="text-2xl text-foreground">Tudo conferido</p>
            <p className="text-base font-semibold text-muted-foreground">
              Datas, hotéis e bilhetes batem.
            </p>
          </section>
        ) : (
          visiveis.map((a) => (
            <Cartao key={`${a.regra_id}-${a.hash_dos_dados}`} a={a} tripId={id} aoDispensar={() => dispensar(a)} />
          ))
        )}
      </main>
    </>
  );
}

const CORES = {
  resolver: { fundo: "bg-danger", texto: "text-danger-foreground", Icone: CircleAlert, rotulo: "Resolver" },
  conferir: { fundo: "bg-warn", texto: "text-warn-foreground", Icone: TriangleAlert, rotulo: "Conferir" },
  sugestao: { fundo: "bg-accent", texto: "text-accent-foreground", Icone: Lightbulb, rotulo: "Sugestão" },
} as const;

function Cartao({ a, tripId, aoDispensar }: { a: Achado; tripId: string; aoDispensar: () => void }) {
  const c = CORES[a.severidade];
  const alvo = a.correcao?.alvo === "hospedagem" ? "/trip/$id/hospedagem" : a.correcao?.alvo === "bilhetes" ? "/trip/$id/bilhetes" : "/trip/$id";
  return (
    <article className="shadow-soft overflow-hidden rounded-2xl border border-border bg-card">
      <div className={`flex items-center gap-3 ${c.fundo} ${c.texto} px-4 py-3`}>
        <c.Icone size={28} strokeWidth={2.2} className="shrink-0" />
        <span className="text-sm font-bold uppercase tracking-wide">{c.rotulo}</span>
      </div>

      <p className="px-4 pt-4 text-lg font-bold leading-snug text-foreground">{a.mensagem}</p>

      <div className="grid grid-cols-2 gap-3 p-4">
        {a.itens.slice(0, 2).map((i, n) => (
          <MiniCard key={`${i.id}-${n}`} i={i} />
        ))}
      </div>

      <Link
        to={alvo as never}
        params={{ id: tripId } as never}
        className="gradient-hero tap mx-4 mb-3 flex items-center justify-center gap-3 rounded-xl text-lg font-bold"
      >
        {a.correcao?.rotulo ?? "Ver item"}
      </Link>
      <button
        onClick={aoDispensar}
        className="tap w-full border-t border-border text-base font-semibold text-muted-foreground"
      >
        Está certo
      </button>
    </article>
  );
}

function MiniCard({ i }: { i: ItemRef }) {
  const Icone = i.tipo === "bilhete" ? Plane : i.tipo === "hospedagem" ? BedDouble : CalendarDays;
  return (
    <div className="rounded-xl border border-border bg-muted p-3">
      <Icone size={28} strokeWidth={2.2} className="text-accent" />
      <p className="mt-2 truncate text-base font-bold text-foreground">{i.titulo}</p>
      <p className="text-sm font-semibold text-muted-foreground">{i.linha1}</p>
      {i.linha2 && <p className="text-sm font-semibold text-muted-foreground">{i.linha2}</p>}
    </div>
  );
}
