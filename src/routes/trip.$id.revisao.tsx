import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CircleAlert, TriangleAlert, Lightbulb, ShieldCheck, Plane, BedDouble, CalendarDays, Send, MessageCircle, FileSearch, Settings2 } from "lucide-react";
import { Topo } from "@/components/Chrome";
import { useAuditoria, useDispensar } from "@/lib/auditoria";
import type { Achado, ItemRef } from "@/lib/audit";
import { conferirQuery, entryRulesQuery, ticketsQuery, tripQuery } from "@/lib/data";
import { ATALHOS, conferir, ordenar, regraPassaporte, type Cartao as CartaoP, type Nivel } from "@/lib/conferencia";
import { carregarAeroportos, porIata } from "@/lib/aeroportos";
import { mutar } from "@/lib/outbox";
import { abrirWhatsApp, mensagemLembrete } from "@/lib/links";
import { supabase } from "@/integrations/supabase/client";
import { origemApp } from "@/lib/site";

export const Route = createFileRoute("/trip/$id/revisao")({
  head: () => ({
    meta: [
      { title: "Está tudo certo? — Evoque Viagens" },
      { name: "description", content: "Conferência por pessoa: passaporte, nomes, vistos, vacina e seguro." },
      { property: "og:title", content: "Está tudo certo?" },
      { property: "og:description", content: "Conferência por pessoa: passaporte, nomes, vistos, vacina e seguro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Revisao,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-lg">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-lg">Nada para revisar.</div>,
});

function Revisao() {
  const { id } = Route.useParams();
  const [aba, setAba] = useState<"pessoas" | "datas">("pessoas");
  return (
    <>
      <Topo titulo="Está tudo certo?" voltarPara="/trip/$id" voltarParams={{ id }} />
      <div role="tablist" className="grid grid-cols-2 gap-2 px-4 pt-4">
        {(["pessoas", "datas"] as const).map((a) => (
          <button key={a} role="tab" aria-selected={aba === a} onClick={() => setAba(a)}
            className={`tap rounded-xl text-lg font-bold ${aba === a ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground"}`}>
            {a === "pessoas" ? "Pessoas" : "Datas e hotéis"}
          </button>
        ))}
      </div>
      {aba === "pessoas" ? <Pessoas id={id} /> : <Datas id={id} />}
    </>
  );
}

const COR: Record<Nivel, string> = { resolver: "bg-danger text-danger-foreground", esperando: "bg-warn text-warn-foreground", conferir: "bg-accent text-accent-foreground", ok: "bg-ok text-ok-foreground" };

function Pessoas({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data: trip } = useQuery(tripQuery(id));
  const { data: lista = [], isLoading } = useQuery(conferirQuery(id));
  const { data: regras = [] } = useQuery(entryRulesQuery());
  const { data: bilhetes = [] } = useQuery(ticketsQuery(id));
  // Telefone da ficha: só vem de quem tem conta e liberou o bloco básico (ou é da família do organizador).
  const { data: fones = {} } = useQuery({
    queryKey: ["telefones", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("telefones_viagem", { _tid: id });
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.person_id, r.telefone])) as Record<string, string>;
    },
  });
  const [paises, setPaises] = useState<string[]>([]);
  const [ajustar, setAjustar] = useState(false);
  useEffect(() => {
    void carregarAeroportos().then((a) => {
      const ps = new Set<string>();
      for (const b of bilhetes) { const x = b.destino_iata ? porIata(a, b.destino_iata) : null; if (x && x.pais !== "BR") ps.add(x.pais); }
      setPaises([...ps]);
    });
  }, [bilhetes]);
  const ajuste = (trip as unknown as { regra_passaporte?: { meses?: number; base?: string } | null })?.regra_passaporte ?? null;
  const regra = trip ? regraPassaporte(trip, paises, ajuste) : null;
  const cartoes = useMemo(() => (trip && regra ? ordenar(lista.map((c) => conferir(c, trip, trip.destino || trip.nome, paises, regra, regras))) : []), [lista, trip, regra, paises, regras]);

  async function salvarRegra(meses: number | null, base: string) {
    const valores = { regra_passaporte: meses ? { meses, base } : null };
    qc.setQueryData(tripQuery(id).queryKey, (t) => (t ? { ...t, ...valores } : t));
    await mutar({ tipo: "update", tabela: "trip", id, valores }).catch((e) => toast.error((e as Error).message));
    setAjustar(false);
  }

  if (isLoading || !trip || !regra) return <p className="p-6 text-lg text-muted-foreground">Conferindo…</p>;
  return (
    <main className="space-y-4 px-4 pb-32 pt-4">
      <section className="rounded-[18px] border border-border bg-card p-4">
        <p className="text-base font-semibold text-foreground">
          Passaporte: valer {regra.meses} meses após a {regra.base === "saida" ? "saída" : "chegada"}{paises.length ? ` · ${paises.join(", ")}` : ""} · {regra.geral ? "regra geral · confirme" : "ajustado por você"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">O app avisa, não garante. Confirme sempre no consulado.</p>
        <button onClick={() => setAjustar((v) => !v)} className="tap mt-2 flex items-center gap-2 text-lg font-bold text-accent"><Settings2 size={24} /> Ajustar para este destino</button>
        {ajustar && <AjusteRegra atual={regra} onSalvar={salvarRegra} />}
      </section>
      {cartoes.map((c) => <CartaoPessoa key={c.c.member_id} k={c} tripId={id} destino={trip.destino || trip.nome} fone={fones[c.c.person_id] ?? c.c.convite_telefone} />)}
      {cartoes.length === 0 && <p className="text-lg text-muted-foreground">Ninguém na viagem ainda.</p>}
    </main>
  );
}

function AjusteRegra({ atual, onSalvar }: { atual: { meses: number; base: string }; onSalvar: (m: number | null, b: string) => void }) {
  const [meses, setMeses] = useState(String(atual.meses));
  const [base, setBase] = useState(atual.base);
  return (
    <div className="mt-3 space-y-3">
      <label className="block text-base font-bold">Meses de validade
        <input inputMode="numeric" value={meses} onChange={(e) => setMeses(e.target.value.replace(/\D/g, ""))} className="tap mt-1 w-full rounded-xl border border-border bg-background px-3 text-lg" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        {(["saida", "chegada"] as const).map((b) => <button key={b} onClick={() => setBase(b)} className={`tap rounded-xl text-lg font-bold ${base === b ? "bg-primary text-primary-foreground" : "border border-border"}`}>Após a {b === "saida" ? "saída" : "chegada"}</button>)}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => onSalvar(null, "")} className="tap rounded-xl border border-border text-lg font-bold">Usar regra geral</button>
        <button onClick={() => onSalvar(Number(meses) || null, base)} className="tap gradient-hero rounded-xl text-lg font-bold">Salvar</button>
      </div>
    </div>
  );
}

function CartaoPessoa({ k, tripId, destino, fone }: { k: CartaoP; tripId: string; destino: string; fone: string | null }) {
  const [aviso, setAviso] = useState<string | null>(null);
  const primeiro = k.c.nome.split(" ")[0] ?? k.c.nome;
  const achadoAviso = k.achados.find((a) => a.aviso);
  useEffect(() => { if (window.location.hash === `#p-${k.c.person_id}`) document.getElementById(`p-${k.c.person_id}`)?.scrollIntoView({ block: "start" }); }, [k.c.person_id]);
  return (
    <article id={`p-${k.c.person_id}`} className="scroll-mt-4 shadow-soft overflow-hidden rounded-[18px] border border-border bg-card">
      <div className={`flex items-center gap-3 px-4 py-3 ${COR[k.nivel]}`}>
        <span className="flex-1 text-lg font-bold">{k.c.nome}{k.c.kind === "dependent" && k.c.meu ? " · sua família" : ""}</span>
        <span className="text-sm font-bold uppercase tracking-wide">{k.nivel === "esperando" ? (k.semConta ? "Sem conta" : k.c.pedido_aberto ? "Esperando" : "Sem acesso") : k.titulo}</span>
      </div>
      <div className="space-y-2 p-4">
        {(k.semAcesso || k.semConta) && <p className="text-lg font-semibold text-foreground">{k.titulo}</p>}
        {k.achados.map((a, i) => (
          <p key={i} className="flex gap-2 text-base text-foreground">
            <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${COR[a.nivel].split(" ")[0] ?? ""}`} aria-hidden />
            <span>{a.texto}</span>
          </p>
        ))}
        {k.c.avisos_abertos > 0 && <p className="text-base font-semibold text-muted-foreground">{k.c.avisos_abertos} aviso(s) aberto(s)</p>}
      </div>
      {k.semAcesso && !k.c.pedido_aberto && (
        <Link to="/trip/$id/pedir/$pid" params={{ id: tripId, pid: k.c.person_id }} className="tap gradient-hero mx-4 mb-4 flex items-center justify-center gap-2 rounded-xl text-lg font-bold">
          <FileSearch size={24} /> Pedir documentos
        </Link>
      )}
      {k.semConta && (
        <button onClick={() => abrirWhatsApp(fone, mensagemLembrete("pt", primeiro, `${origemApp()}/`))} className="tap mx-4 mb-4 flex w-[calc(100%-2rem)] items-center justify-center gap-2 rounded-xl border border-border text-lg font-bold">
          <MessageCircle size={24} /> Lembrar pelo WhatsApp
        </button>
      )}
      {!k.semConta && !k.semAcesso && !k.c.meu && (
        aviso === null ? (
          <button onClick={() => setAviso(achadoAviso?.aviso ?? "")} className="tap w-full border-t border-border text-lg font-bold text-accent">
            <Send size={22} className="mr-2 inline" /> Enviar aviso
          </button>
        ) : (
          <AvisoForm tripId={tripId} k={k} texto={aviso} setTexto={setAviso} primeiro={primeiro} destino={destino} fone={fone} campoInicial={achadoAviso?.campo ?? null} />
        )
      )}
    </article>
  );
}

function AvisoForm({ tripId, k, texto, setTexto, primeiro, destino, fone, campoInicial }: { tripId: string; k: CartaoP; fone: string | null; texto: string; setTexto: (t: string | null) => void; primeiro: string; destino: string; campoInicial: string | null }) {
  const qc = useQueryClient();
  const [campo, setCampo] = useState<string | null>(campoInicial);
  async function enviarAviso(whats: boolean) {
    if (!texto.trim()) return;
    try {
      const r = await mutar({ tipo: "insert", tabela: "trip_notice", valores: { id: crypto.randomUUID(), trip_id: tripId, person_id: k.c.person_id, tipo: "aviso", mensagem: texto.trim(), campo, canal: whats ? "app+whatsapp" : "app" } });
      if (whats) abrirWhatsApp(fone, texto.trim());
      toast.success(r === "fila" ? "Guardado. Envia quando a internet voltar." : "Aviso enviado.");
      setTexto(null);
      void qc.invalidateQueries({ queryKey: ["conferir", tripId] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <div className="space-y-3 border-t border-border p-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(ATALHOS) as (keyof typeof ATALHOS)[]).map((a) => (
          <button key={a} onClick={() => { setCampo(a); setTexto(ATALHOS[a](primeiro, destino)); }} className={`tap rounded-full px-4 text-base font-bold ${campo === a ? "bg-primary text-primary-foreground" : "border border-border"}`}>
            {a.charAt(0).toUpperCase() + a.slice(1)}
          </button>
        ))}
      </div>
      <textarea aria-label="Mensagem do aviso" value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} className="w-full rounded-xl border border-border bg-background p-3 text-lg" />
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => enviarAviso(false)} className="tap gradient-hero rounded-xl text-lg font-bold">Enviar no app</button>
        <button onClick={() => enviarAviso(true)} className="tap rounded-xl border border-border text-lg font-bold">App + WhatsApp</button>
      </div>
      <button onClick={() => setTexto(null)} className="tap w-full text-base font-semibold text-muted-foreground">Cancelar</button>
    </div>
  );
}

function Datas({ id }: { id: string }) {
  const { visiveis } = useAuditoria(id);
  const dispensar = useDispensar(id);
  return (
    <main className="space-y-4 px-4 pb-32 pt-4">
      {visiveis.length === 0 ? (
        <section className="flex flex-col items-center gap-4 rounded-3xl bg-muted px-6 py-16 text-center">
          <ShieldCheck size={56} strokeWidth={2.2} className="text-ok" />
          <p className="text-2xl text-foreground">Tudo conferido</p>
          <p className="text-base font-semibold text-muted-foreground">Datas, hotéis e bilhetes batem.</p>
        </section>
      ) : (
        visiveis.map((a) => <CartaoData key={`${a.regra_id}-${a.hash_dos_dados}`} a={a} tripId={id} aoDispensar={() => dispensar(a)} />)
      )}
    </main>
  );
}

const CORES = {
  resolver: { fundo: "bg-danger", texto: "text-danger-foreground", Icone: CircleAlert, rotulo: "Resolver" },
  conferir: { fundo: "bg-warn", texto: "text-warn-foreground", Icone: TriangleAlert, rotulo: "Conferir" },
  sugestao: { fundo: "bg-accent", texto: "text-accent-foreground", Icone: Lightbulb, rotulo: "Sugestão" },
} as const;

function CartaoData({ a, tripId, aoDispensar }: { a: Achado; tripId: string; aoDispensar: () => void }) {
  const c = CORES[a.severidade];
  const alvo = a.correcao?.alvo === "hospedagem" ? "/trip/$id/hospedagem" : a.correcao?.alvo === "bilhetes" ? "/trip/$id/bilhetes" : "/trip/$id";
  return (
    <article className="shadow-soft overflow-hidden rounded-2xl border border-border bg-card">
      <div className={`flex items-center gap-3 ${c.fundo} ${c.texto} px-4 py-3`}>
        <c.Icone size={28} strokeWidth={2.2} className="shrink-0" />
        <span className="text-sm font-bold uppercase tracking-wide">{c.rotulo}</span>
      </div>
      <p className="px-4 pt-4 text-lg font-bold leading-snug text-foreground">{a.mensagem}</p>
      <div className="grid grid-cols-2 gap-3 p-4">{a.itens.slice(0, 2).map((i, n) => <MiniCard key={`${i.id}-${n}`} i={i} />)}</div>
      <Link to={alvo as never} params={{ id: tripId } as never} className="gradient-hero tap mx-4 mb-3 flex items-center justify-center gap-3 rounded-xl text-lg font-bold">{a.correcao?.rotulo ?? "Ver item"}</Link>
      <button onClick={aoDispensar} className="tap w-full border-t border-border text-base font-semibold text-muted-foreground">Está certo</button>
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
