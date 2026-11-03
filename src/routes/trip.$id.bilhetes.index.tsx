import { createFileRoute, Link } from "@tanstack/react-router";
import { CartaoResumo } from "@/components/CartaoResumo";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AvatarPessoa } from "@/components/Pessoa";
import { chaveVoo, type StatusVoo as StatusVooT } from "@/lib/voo";
import { Plane, TrainFront, Bus, Car, Plus, Users, ArrowRight, ChevronRight } from "lucide-react";
import { Topo } from "@/components/Chrome";
import { Logo } from "@/components/Logo";
import { logoCia, temLogos } from "@/lib/logos";
import {
  flightStatusQuery,
  membersQuery,
  roteiroQuery,
  ticketsQuery,
  type ItemRoteiro,
  type Membro,
  type Ticket,
} from "@/lib/data";
import { chaveDia, dataBRCurta, horaNoFuso, fusoLocal, nomeFusoCurto } from "@/lib/format";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const Route = createFileRoute("/trip/$id/bilhetes/")({
  validateSearch: (s: Record<string, unknown>): { p?: string } =>
    typeof s.p === "string" ? { p: s.p } : {},
  head: () => ({
    meta: [
      { title: "Transporte — Viagens Organizadas" },
      { name: "description", content: "Cartões de embarque da viagem, agrupados por dia." },
      { property: "og:title", content: "Transporte" },
      { property: "og:description", content: "Cartões de embarque da viagem, agrupados por dia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Bilhetes,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-lg">
      {(error as Error).message}
    </div>
  ),
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
  const { p: sel } = Route.useSearch();
  const { data: detalhes } = useSuspenseQuery(ticketsQuery(id));
  const { data: roteiro } = useSuspenseQuery(roteiroQuery(id));
  const { data: membros } = useSuspenseQuery(membersQuery(id));
  const { data: status } = useQuery(flightStatusQuery(id));
  const porId = new Map(detalhes.map((b) => [b.id, b]));
  const itens = roteiro.filter((r) => r.item_tipo === "ticket");
  for (const b of detalhes)
    if (!itens.some((r) => r.item_id === b.id))
      itens.push({
        item_tipo: "ticket",
        item_id: b.id,
        subtipo: b.tipo,
        titulo: "",
        inicio_utc: b.partida_utc,
        inicio_tz: b.partida_tz,
        fim_utc: b.chegada_utc,
        fim_tz: b.chegada_tz,
        cidade: null,
        origem_iata: null,
        destino_iata: null,
        companhia: null,
        numero: null,
        pessoas: [],
        detalhe: true,
        editar: true,
      });
  itens.sort((a, b) => a.inicio_utc.localeCompare(b.inicio_utc));
  const ativos = membros.filter((m) => m.status !== "recusado" && m.status !== "saiu");
  const dono = membros.find((m) => m.papel === "owner");
  const pessoa = sel ? membros.find((m) => m.person_id === sel) : undefined;
  if (pessoa) {
    const meus = new Set(
      detalhes
        .filter((b) => b.passageiros.some((q) => q.person_id === pessoa.person_id))
        .map((b) => b.id),
    );
    for (let i = itens.length - 1; i >= 0; i--)
      if (!meus.has(itens[i]!.item_id)) itens.splice(i, 1);
  }
  // Mesmo voo em registros diferentes (um por pessoa) = um cartão só na visão "Todos".
  const grupoDe = (b: Ticket) => {
    const k = chaveVoo(b);
    return k ? detalhes.filter((x) => chaveVoo(x) === k) : [b];
  };
  if (!pessoa) {
    const vistos = new Set<string>();
    for (let i = 0; i < itens.length; i++) {
      const b = porId.get(itens[i]!.item_id);
      const k = b && chaveVoo(b);
      if (!k) continue;
      if (vistos.has(k)) itens.splice(i--, 1);
      else vistos.add(k);
    }
  }
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
      <Topo titulo="Transporte" voltarPara="/trip/$id" voltarParams={{ id }} />
      <main className="space-y-6 px-4 pt-4">
        <FileiraPessoas tripId={id} membros={ativos} sel={pessoa?.person_id} />
        {bilhetes.length === 0 &&
          (pessoa ? (
            <p className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-lg font-semibold">
              Nada de {pessoa.apelido || pessoa.nome.split(" ")[0]} ainda
            </p>
          ) : (
            <Link
              to="/trip/$id/bilhetes/novo"
              params={{ id }}
              className="tap flex w-full items-center justify-center rounded-2xl border-2 border-dashed border-voos-border p-8 text-lg font-bold text-voos"
            >
              + Primeiro transporte
            </Link>
          ))}
        {[...grupos.entries()].map(([dia, itens]) => (
          <section key={dia}>
            <h2 className="text-base font-bold uppercase tracking-wide text-muted-foreground">
              {dataBRCurta(dia)}
            </h2>
            <div className="mt-2 space-y-3">
              {itens.map((r) => {
                const b = porId.get(r.item_id);
                return b ? (
                  <CartaoEmbarque
                    key={r.item_id}
                    b={b}
                    grupo={grupoDe(b)}
                    s={status?.[b.id]}
                    nome={nome}
                    dono={dono}
                    pessoa={pessoa?.person_id}
                  />
                ) : (
                  <CartaoResumo key={r.item_id} r={r} />
                );
              })}
            </div>
          </section>
        ))}

        <Link
          to="/trip/$id/bilhetes/novo"
          params={{ id }}
          search={pessoa ? { para: pessoa.person_id } : {}}
          className="tap flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-accent text-xl font-bold text-accent"
        >
          <Plus size={28} strokeWidth={2.2} />
          {pessoa ? `Bilhete de ${pessoa.apelido || pessoa.nome.split(" ")[0]}` : "Novo bilhete"}
        </Link>
        {bilhetes.length > 0 && temLogos() && (
          <p className="pb-2 text-center text-xs text-muted-foreground">
            <a href="https://logo.dev" target="_blank" rel="noopener noreferrer">
              Logos por Logo.dev
            </a>
          </p>
        )}
      </main>
    </>
  );
}

function FileiraPessoas({
  tripId,
  membros,
  sel,
}: {
  tripId: string;
  membros: Membro[];
  sel?: string;
}) {
  const ids = membros.map((m) => m.person_id);
  const { data: fotos = {} } = useQuery({
    queryKey: ["barra-fotos", ids.join(",")],
    networkMode: "offlineFirst",
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await db.from("person").select("id,foto_url").in("id", ids);
      return Object.fromEntries(
        ((data ?? []) as { id: string; foto_url: string | null }[]).map((p) => [p.id, p.foto_url]),
      ) as Record<string, string | null>;
    },
  });
  if (membros.length < 2) return null;
  const eu = membros.find((m) => m.meu && m.kind === "self");
  const ordem = eu ? [eu, ...membros.filter((m) => m !== eu)] : membros;
  const cls = "flex shrink-0 flex-col items-center gap-1";
  return (
    <nav
      aria-label="Transporte por pessoa"
      className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
    >
      <Link
        to="/trip/$id/bilhetes"
        params={{ id: tripId }}
        search={{}}
        className={cls}
        aria-current={!sel ? "page" : undefined}
      >
        <span className={`rounded-full p-0.5 ${!sel ? "ring-4 ring-ok" : ""}`}>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <Users size={26} strokeWidth={2.2} />
          </span>
        </span>
        <span className={`text-sm ${!sel ? "font-bold" : ""}`}>Todos</span>
      </Link>
      {ordem.map((m) => {
        const ativo = m.person_id === sel;
        return (
          <Link
            key={m.id}
            to="/trip/$id/bilhetes"
            params={{ id: tripId }}
            search={{ p: m.person_id }}
            className={cls}
            aria-current={ativo ? "page" : undefined}
          >
            <span className={`rounded-full p-0.5 ${ativo ? "ring-4 ring-ok" : ""}`}>
              <AvatarPessoa nome={m.nome} foto={fotos[m.person_id] ?? null} tamanho={56} />
            </span>
            <span className={`max-w-[72px] truncate text-sm ${ativo ? "font-bold" : ""}`}>
              {m === eu ? "Eu" : (m.apelido || m.nome).split(" ")[0]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function Selo({
  pax,
  dono,
  pessoa,
}: {
  pax: Ticket["passageiros"];
  dono?: Membro;
  pessoa?: string;
}) {
  if (!dono || pessoa === dono.person_id) return null;
  const outros = pax.filter((q) => q.person_id !== dono.person_id);
  if (!pessoa && !outros.length) return null;
  const mesmo = pax.some((q) => q.person_id === dono.person_id);
  const n = dono.apelido || dono.nome.split(" ")[0];
  return mesmo ? (
    <span className="inline-flex rounded-full bg-secondary px-3 py-1 text-sm font-bold text-secondary-foreground">
      Mesmo voo de {n}
    </span>
  ) : (
    <span className="inline-flex rounded-full border border-warn/40 bg-warn/10 px-3 py-1 text-sm font-bold text-foreground">
      Voo diferente do organizador
    </span>
  );
}

function CartaoEmbarque({
  b,
  grupo,
  s,
  nome,
  dono,
  pessoa,
}: {
  b: Ticket;
  grupo: Ticket[];
  s?: StatusVooT;
  nome: (pid: string) => string;
  dono?: Membro;
  pessoa?: string;
}) {
  const pax = grupo
    .flatMap((t) => t.passageiros)
    .filter((q, i, l) => l.findIndex((x) => x.person_id === q.person_id) === i);
  const Icone = ICONE[b.tipo] ?? Plane;
  return (
    <Link
      to="/trip/$id/item/$tipo/$itemId"
      params={{ id: b.trip_id, tipo: "ticket", itemId: b.id }}
      className="tap grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl cartao-voo px-4 text-primary-foreground shadow-soft"
    >
      <Logo
        url={b.tipo === "voo" ? logoCia(b.companhia, b.numero) : null}
        Icone={Icone}
        nome={b.companhia ?? b.tipo}
        tamanho={32}
      />
      <span className="min-w-0">
        <strong className="flex items-center gap-1 truncate text-lg">
          {b.origem_iata ?? b.origem_cidade ?? "—"}
          <ArrowRight size={17} />
          {b.destino_iata ?? b.destino_cidade ?? "—"}
        </strong>
        <span className="block truncate text-sm opacity-80">
          {horaNoFuso(b.partida_utc, b.partida_tz)} ·{" "}
          {[b.companhia, b.numero].filter(Boolean).join(" ")} ·{" "}
          {pax.map((p) => nome(p.person_id)).join(", ")}
        </span>
        <Selo pax={pax} dono={dono} pessoa={pessoa} />
      </span>
      <ChevronRight size={24} className="shrink-0" aria-hidden />
      {s?.status && <span className="sr-only">Status {s.status}</span>}
    </Link>
  );
}
