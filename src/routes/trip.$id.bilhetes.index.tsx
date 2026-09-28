import { createFileRoute, Link } from "@tanstack/react-router";
import { AcoesItem } from "@/components/AcoesItem";
import { AnexosItem } from "@/components/AnexosItem";
import { CartaoResumo } from "@/components/CartaoResumo";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AvatarPessoa } from "@/components/Pessoa";
import { mutar } from "@/lib/outbox";
import { aviso, naTela } from "@/lib/itens";
import { textoBagagem, pegarBagagem } from "@/lib/bagagem";
import { StatusVoo } from "@/components/StatusVoo";
import { chaveVoo, type StatusVoo as StatusVooT } from "@/lib/voo";
import { sufixoNome } from "@/lib/nomes";
import { useState } from "react";
import { Plane, TrainFront, Bus, Car, Plus, ChevronDown, Users, Pencil, UserMinus } from "lucide-react";
import { Topo } from "@/components/Chrome";
import { Logo } from "@/components/Logo";
import { logoCia } from "@/lib/logos";
import { flightStatusQuery, membersQuery, roteiroQuery, ticketsQuery, type ItemRoteiro, type Membro, type Ticket } from "@/lib/data";
import { chaveDia, dataBRCurta, horaNoFuso, fusoLocal, nomeFusoCurto } from "@/lib/format";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const Route = createFileRoute("/trip/$id/bilhetes/")({
  validateSearch: (s: Record<string, unknown>): { p?: string } => (typeof s.p === "string" ? { p: s.p } : {}),
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
  const { p: sel } = Route.useSearch();
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
  const ativos = membros.filter((m) => m.status !== "recusado" && m.status !== "saiu");
  const dono = membros.find((m) => m.papel === "owner");
  const pessoa = sel ? membros.find((m) => m.person_id === sel) : undefined;
  if (pessoa) {
    const meus = new Set(detalhes.filter((b) => b.passageiros.some((q) => q.person_id === pessoa.person_id)).map((b) => b.id));
    for (let i = itens.length - 1; i >= 0; i--) if (!meus.has(itens[i]!.item_id)) itens.splice(i, 1);
  }
  // Mesmo voo em registros diferentes (um por pessoa) = um cartão só na visão "Todos".
  const grupoDe = (b: Ticket) => { const k = chaveVoo(b); return k ? detalhes.filter((x) => chaveVoo(x) === k) : [b]; };
  if (!pessoa) {
    const vistos = new Set<string>();
    for (let i = 0; i < itens.length; i++) {
      const b = porId.get(itens[i]!.item_id); const k = b && chaveVoo(b);
      if (!k) continue;
      if (vistos.has(k)) itens.splice(i--, 1); else vistos.add(k);
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
      <Topo titulo="Bilhetes" voltarPara="/trip/$id" voltarParams={{ id }} />
      <main className="space-y-6 px-4 pt-4">
        <FileiraPessoas tripId={id} membros={ativos} sel={pessoa?.person_id} />
        {bilhetes.length === 0 && (
          <p className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-lg font-semibold">
            {pessoa ? `Nenhum bilhete de ${pessoa.apelido || pessoa.nome.split(" ")[0]}` : "Nenhum bilhete ainda"}
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
                return b ? <CartaoEmbarque key={r.item_id} b={b} grupo={grupoDe(b)} s={status?.[b.id]} editar={r.editar} nome={nome} dono={dono} pessoa={pessoa?.person_id} membros={membros} /> : <CartaoResumo key={r.item_id} r={r} />;
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
      </main>
    </>
  );
}

function FileiraPessoas({ tripId, membros, sel }: { tripId: string; membros: Membro[]; sel?: string }) {
  const ids = membros.map((m) => m.person_id);
  const { data: fotos = {} } = useQuery({
    queryKey: ["barra-fotos", ids.join(",")],
    networkMode: "offlineFirst",
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await db.from("person").select("id,foto_url").in("id", ids);
      return Object.fromEntries(((data ?? []) as { id: string; foto_url: string | null }[]).map((p) => [p.id, p.foto_url])) as Record<string, string | null>;
    },
  });
  if (membros.length < 2) return null;
  const eu = membros.find((m) => m.meu && m.kind === "self");
  const ordem = eu ? [eu, ...membros.filter((m) => m !== eu)] : membros;
  const cls = "flex shrink-0 flex-col items-center gap-1";
  return (
    <nav aria-label="Bilhetes por pessoa" className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      <Link to="/trip/$id/bilhetes" params={{ id: tripId }} search={{}} className={cls} aria-current={!sel ? "page" : undefined}>
        <span className={`rounded-full p-0.5 ${!sel ? "ring-4 ring-ok" : ""}`}>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground"><Users size={26} strokeWidth={2.2} /></span>
        </span>
        <span className={`text-sm ${!sel ? "font-bold" : ""}`}>Todos</span>
      </Link>
      {ordem.map((m) => {
        const ativo = m.person_id === sel;
        return (
          <Link key={m.id} to="/trip/$id/bilhetes" params={{ id: tripId }} search={{ p: m.person_id }} className={cls} aria-current={ativo ? "page" : undefined}>
            <span className={`rounded-full p-0.5 ${ativo ? "ring-4 ring-ok" : ""}`}><AvatarPessoa nome={m.nome} foto={fotos[m.person_id] ?? null} tamanho={56} /></span>
            <span className={`max-w-[72px] truncate text-sm ${ativo ? "font-bold" : ""}`}>{m === eu ? "Eu" : (m.apelido || m.nome).split(" ")[0]}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Selo({ pax, dono, pessoa }: { pax: Ticket["passageiros"]; dono?: Membro; pessoa?: string }) {
  if (!dono || pessoa === dono.person_id) return null;
  const outros = pax.filter((q) => q.person_id !== dono.person_id);
  if (!pessoa && !outros.length) return null;
  const mesmo = pax.some((q) => q.person_id === dono.person_id);
  const n = dono.apelido || dono.nome.split(" ")[0];
  return mesmo ? (
    <span className="inline-flex rounded-full bg-secondary px-3 py-1 text-sm font-bold text-secondary-foreground">Mesmo voo de {n}</span>
  ) : (
    <span className="inline-flex rounded-full border border-warn/40 bg-warn/10 px-3 py-1 text-sm font-bold text-foreground">Voo diferente do organizador</span>
  );
}

function CartaoEmbarque({ b, grupo, s, editar, nome, dono, pessoa, membros }: { b: Ticket; grupo: Ticket[]; s?: StatusVooT; editar: boolean; nome: (pid: string) => string; dono?: Membro; pessoa?: string; membros: Membro[] }) {
  const [aberto, setAberto] = useState(false);
  const qc = useQueryClient();
  const pax = grupo.flatMap((t) => t.passageiros).filter((q, i, l) => l.findIndex((x) => x.person_id === q.person_id) === i);
  const minha = pessoa ? b.passageiros.find((q) => q.person_id === pessoa) : undefined;
  async function tirar() {
    if (!minha) return;
    const key = ticketsQuery(b.trip_id).queryKey;
    const ultimo = b.passageiros.length === 1;
    const agora = new Date().toISOString();
    naTela<Ticket>(qc, key, (l) => (ultimo ? l.filter((x) => x.id !== b.id) : l.map((x) => (x.id === b.id ? { ...x, passageiros: x.passageiros.filter((q) => q.id !== minha.id) } : x))));
    const volta = () => naTela<Ticket>(qc, key, (l) => [...l.filter((x) => x.id !== b.id), b].sort((a, c) => a.partida_utc.localeCompare(c.partida_utc)));
    try {
      const r = await mutar({ tipo: "update", tabela: "ticket_passenger", id: minha.id, valores: { deleted_at: agora } });
      if (ultimo) await mutar({ tipo: "update", tabela: "ticket", id: b.id, valores: { deleted_at: agora } });
      toast(aviso(r, ultimo ? "Voo apagado" : `${nome(minha.person_id)} saiu do voo`), {
        duration: 10_000,
        action: { label: "Desfazer", onClick: () => { volta(); void mutar({ tipo: "update", tabela: "ticket_passenger", id: minha.id, valores: { deleted_at: null } }); if (ultimo) void mutar({ tipo: "update", tabela: "ticket", id: b.id, valores: { deleted_at: null } }); } },
      });
      void qc.invalidateQueries({ queryKey: ["roteiro", b.trip_id] });
    } catch (e) {
      volta();
      toast.error((e as Error).message || "Não deu para tirar.");
    }
  }
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
          {(minha?.localizador || b.localizador) && (
            <p className="mono-code text-2xl font-bold text-accent">{minha?.localizador || b.localizador}</p>
          )}
          {minha?.classe && <p className="text-lg font-bold text-foreground">Classe {minha.classe}</p>}
          <p className="mt-2 text-base font-semibold text-muted-foreground">
            Chega {horaNoFuso(b.chegada_utc, b.chegada_tz)} · {dataBRCurta(chaveDia(b.chegada_utc, b.chegada_tz))}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {pax.length > 1 && (
              <span className="flex -space-x-2">
                {pax.slice(0, 6).map((q) => <span key={q.id} className="rounded-full border-2 border-card"><AvatarPessoa nome={membros.find((m) => m.person_id === q.person_id)?.nome ?? "?"} foto={null} tamanho={32} /></span>)}
              </span>
            )}
            <Selo pax={pax} dono={dono} pessoa={pessoa} />
          </div>
        </div>
      </div>

      <StatusVoo b={b} s={s} />

      {minha && (
        <dl className="space-y-2 border-t border-border p-4 text-lg">
          <Linha rotulo="Assento" valor={minha.assento} />
          <Linha rotulo="Nome no bilhete" valor={minha.nome_no_bilhete} />
          {minha.nome_no_bilhete && (() => {
            const doc = membros.find((m) => m.person_id === minha.person_id)?.nome_como_no_documento ?? "";
            const sb = sufixoNome(minha.nome_no_bilhete);
            const sd = sufixoNome(doc);
            if (!sb && !sd) return null;
            if (sb && sd) return null; // sufixos diferentes já viram âmbar na conferência
            return <p className="text-sm text-muted-foreground">{sb ? `Bilhete com ${sb}, documento sem` : `Documento com ${sd}, bilhete sem`}</p>;
          })()}
          <Linha rotulo="Nº do bilhete" valor={minha.eticket} />
          <Linha rotulo="Classe" valor={minha.classe ?? null} />
          <Linha rotulo="Bagagem" valor={textoBagagem(pegarBagagem(minha)) || null} />
        </dl>
      )}
      {minha && editar && (
        <div className="grid grid-cols-2 border-t border-border">
          <Link to="/trip/$id/bilhetes/novo" params={{ id: b.trip_id }} search={{ editar: b.id, pax: minha.person_id }} className="tap flex items-center justify-center gap-2 text-lg font-bold text-foreground">
            <Pencil size={24} strokeWidth={2.2} /> Dados dele(a)
          </Link>
          <button onClick={tirar} className="tap flex items-center justify-center gap-2 border-l border-border text-lg font-bold text-destructive">
            <UserMinus size={24} strokeWidth={2.2} /> Tirar do voo
          </button>
        </div>
      )}
      {!pessoa && pax.length > 0 && (
        <ul className="space-y-2 border-t border-border p-4">
          {pax.map((p) => (
            <li key={p.id} className="flex items-baseline justify-between gap-3 text-lg">
              <span className="font-bold text-foreground">{nome(p.person_id)}</span>
              <span className="mono-code text-xl font-bold text-accent">{p.assento ?? "—"}{p.classe ? ` · ${p.classe}` : ""}</span>
            </li>
          ))}
        </ul>
      )}
      {(pessoa ? [b] : grupo).map((t) => <AnexosItem key={t.id} tripId={t.trip_id} itemTipo="ticket" itemId={t.id} podeEditar={editar} />)}
      {editar && !minha && <AcoesItem tabela="ticket" id={b.id} tripId={b.trip_id} editarPara="/trip/$id/bilhetes/novo" queryKey={ticketsQuery(b.trip_id).queryKey} />}

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
          {pax.map((p) => (
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
