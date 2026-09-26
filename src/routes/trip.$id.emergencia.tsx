import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, CloudCheck, MessageCircle, Pencil, Phone, RefreshCw, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { tripQuery, type Trip } from "@/lib/data";
import { mutar } from "@/lib/outbox";
import { aviso, naTela } from "@/lib/itens";
import { abrirWhatsApp } from "@/lib/links";
import { AbrirMapa } from "@/components/AbrirMapa";
import { useBuscarEmergencia, useOnline } from "@/components/CartaoEmergencia";
import { dataBRLonga, tel, type Emergencia, type PaisEmergencia, type PostoEmergencia } from "@/lib/emergencia";

export const Route = createFileRoute("/trip/$id/emergencia")({
  head: () => ({
    meta: [
      { title: "Emergência na viagem — Evoque Viagens" },
      { name: "description", content: "Números de emergência e consulados do Brasil, salvos para abrir sem internet." },
      { property: "og:title", content: "Emergência na viagem" },
      { property: "og:description", content: "Números de emergência e consulados do Brasil, salvos para abrir sem internet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TelaEmergencia,
});

function TelaEmergencia() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: trip } = useSuspenseQuery(tripQuery(id));
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => { void supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null)); }, []);
  const dono = !!uid && uid === trip.owner_id;
  const on = useOnline();
  const { buscar, buscando } = useBuscarEmergencia(id);
  const [editando, setEditando] = useState(false);
  const e = trip.emergencia;
  const chave = tripQuery(id).queryKey;
  const trocar = (v: Emergencia | null) => qc.setQueryData<Trip>(chave, (t) => (t ? { ...t, emergencia: v } : t));

  async function salvar(v: Emergencia | null, msg: string) {
    const antes = e ?? null;
    trocar(v);
    try {
      const r = await mutar({ tipo: "update", tabela: "trip", id, valores: { emergencia: v } });
      return { r, antes };
    } catch (err) {
      trocar(antes);
      toast.error((err as Error).message || "Não deu para salvar.");
      void msg;
      return null;
    }
  }

  async function apagar() {
    const x = await salvar(null, "Apagado");
    if (!x) return;
    toast(aviso(x.r, "Apagado"), {
      duration: 10_000,
      action: { label: "Desfazer", onClick: () => { trocar(x.antes); void mutar({ tipo: "update", tabela: "trip", id, valores: { emergencia: x.antes } }).then((y) => toast.success(aviso(y, "Voltou"))); } },
    });
  }
  void naTela;

  return (
    <>
      <header className="flex items-center gap-3 px-4 py-3">
        <Link to="/trip/$id" params={{ id }} className="tap flex items-center text-lg font-bold">Voltar</Link>
        <h1 className="min-w-0 flex-1 truncate text-2xl">Emergência</h1>
      </header>
      <main className="space-y-4 px-4 pb-28 pt-2">
        {!e ? (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <p className="text-lg">Ainda não há dados de emergência nesta viagem.</p>
            {dono && (
              <button disabled={!on || buscando} onClick={() => void buscar()} className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-60">
                {buscando ? <Loader2 className="animate-spin" size={24} /> : <Phone size={24} />} {on ? "Buscar" : "Precisa de internet para buscar"}
              </button>
            )}
          </div>
        ) : editando ? (
          <Editar valor={e} onCancelar={() => setEditando(false)} onSalvar={async (v) => { const x = await salvar(v, "Salvo"); if (x) { toast.success(aviso(x.r, "Salvo")); setEditando(false); } }} />
        ) : (
          <>
            <p className="flex items-center gap-2 rounded-2xl bg-ok px-4 py-3 text-base font-bold text-ok-foreground">
              <CloudCheck size={24} className="shrink-0" /> Salvo na viagem: abre sem internet. Conferido em {dataBRLonga(e.conferido_em)}
            </p>
            {e.paises.map((p) => <BlocoPais key={p.iso2} p={p} />)}
            <section className="space-y-2 rounded-2xl border-2 border-border bg-card p-4">
              <h2 className="text-xl">Não conseguiu falar com o consulado?</h2>
              <p className="text-lg">Plantão do Itamaraty em Brasília, só para risco à vida, prisão, internação ou desaparecimento.</p>
              <div className="flex gap-2">
                <a href={tel(e.itamaraty)} className="tap flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-lg font-bold text-primary-foreground"><Phone size={22} /> {e.itamaraty}</a>
                <button type="button" onClick={() => abrirWhatsApp(e.itamaraty, "")} className="tap flex items-center justify-center gap-2 rounded-xl border-2 border-border px-4 text-lg font-bold"><MessageCircle size={22} /> WhatsApp</button>
              </div>
            </section>
            <p className="text-base text-muted-foreground">Fontes: Itamaraty (gov.br/mre) e gov.uk</p>
            {dono && (
              <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-border bg-card">
                <button disabled={!on || buscando} onClick={() => void buscar().then((ok) => ok && toast.success("Atualizado"))} className="tap flex flex-col items-center justify-center gap-1 text-base font-bold disabled:opacity-60">
                  {buscando ? <Loader2 size={24} className="animate-spin" /> : <RefreshCw size={24} strokeWidth={2.2} />} {on ? "Atualizar" : "Sem internet"}
                </button>
                <button onClick={() => setEditando(true)} className="tap flex flex-col items-center justify-center gap-1 border-l border-border text-base font-bold"><Pencil size={24} strokeWidth={2.2} /> Editar</button>
                <button onClick={() => void apagar()} className="tap flex flex-col items-center justify-center gap-1 border-l border-border text-base font-bold text-destructive"><Trash2 size={24} strokeWidth={2.2} /> Apagar</button>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

function BlocoPais({ p }: { p: PaisEmergencia }) {
  const [abrir, setAbrir] = useState(false);
  if (p.sem_dados) return <p className="rounded-2xl border-2 border-destructive p-4 text-lg font-bold">Sem dados para {p.pais}. Ligue para o Itamaraty.</p>;
  const nums = [p.policia, p.ambulancia, p.bombeiros].filter(Boolean);
  const iguais = nums.every((n) => n === (p.geral ?? nums[0]));
  const grande = p.geral ?? p.policia;
  return (
    <>
      <section className="space-y-2 rounded-3xl bg-destructive p-5 text-destructive-foreground">
        <p className="text-sm font-bold uppercase tracking-wide opacity-90">{p.pais}</p>
        {grande && <a href={tel(grande)} className="num block text-[44px] font-extrabold leading-none underline-offset-4">{grande}</a>}
        {iguais ? (
          <p className="text-lg font-semibold">Polícia, ambulância e bombeiros</p>
        ) : (
          <div className="space-y-1">
            {([["Polícia", p.policia], ["Ambulância", p.ambulancia], ["Bombeiros", p.bombeiros]] as const).map(([r, n]) => n && (
              <a key={r} href={tel(n)} className="tap flex items-center justify-between rounded-xl bg-background/15 px-3 text-lg font-bold"><span>{r}</span><span className="num">{n}</span></a>
            ))}
          </div>
        )}
        {p.obs && <p className="text-base opacity-90">{p.obs}</p>}
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl">Consulado do Brasil</h2>
        {p.postos.map((x, i) => <CartaoPosto key={i} x={x} />)}
        {!p.postos.length && p.cobertura_sem_posto && <p className="rounded-2xl border border-border bg-card p-4 text-lg">{p.cobertura_sem_posto}</p>}
        {p.outros.length > 0 && (
          <div className="rounded-2xl border border-border bg-card">
            <button type="button" onClick={() => setAbrir(!abrir)} aria-expanded={abrir} className="tap flex w-full items-center gap-2 px-4 text-left text-lg font-bold">
              <span className="flex-1">{p.outros.length > 1 ? "Outros consulados" : "Outro consulado"} em {p.pais}: {p.outros.map((o) => o.cidade).join(", ")}</span>
              <ChevronDown size={24} className={abrir ? "rotate-180" : ""} />
            </button>
            {abrir && <div className="space-y-3 p-3 pt-0">{p.outros.map((x, i) => <CartaoPosto key={i} x={x} />)}</div>}
          </div>
        )}
      </section>
    </>
  );
}

function CartaoPosto({ x }: { x: PostoEmergencia }) {
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
      <h3 className="text-xl">{x.tipo} em {x.cidade}</h3>
      {x.plantao && <a href={tel(x.plantao)} className="tap flex items-center justify-center gap-2 rounded-xl bg-primary text-lg font-bold text-primary-foreground"><Phone size={22} /> Plantão 24h · {x.plantao}</a>}
      {x.telefone && <a href={tel(x.telefone)} className="tap flex items-center justify-center gap-2 rounded-xl border-2 border-border text-lg font-bold"><Phone size={22} /> Horário comercial · {x.telefone}</a>}
      {x.site && <a href={x.site.startsWith("http") ? x.site : `https://${x.site}`} target="_blank" rel="noopener noreferrer" className="block break-all text-base font-bold text-accent">{x.site}</a>}
      {(x.endereco || x.lat) && <AbrirMapa ponto={{ nome: `${x.tipo} do Brasil em ${x.cidade}`, endereco: x.endereco, lat: x.lat, lng: x.lng }} />}
    </div>
  );
}

function Editar({ valor, onSalvar, onCancelar }: { valor: Emergencia; onSalvar: (v: Emergencia) => void; onCancelar: () => void }) {
  const [v, setV] = useState<Emergencia>(() => structuredClone(valor));
  const campo = "w-full rounded-xl border-2 border-border bg-background px-3 py-3 text-lg";
  const setPais = (i: number, k: keyof PaisEmergencia, val: string) => setV((s) => ({ ...s, paises: s.paises.map((p, j) => (j === i ? { ...p, [k]: val || null } : p)) }));
  const setPosto = (i: number, lista: "postos" | "outros", n: number, k: keyof PostoEmergencia, val: string) =>
    setV((s) => ({ ...s, paises: s.paises.map((p, j) => (j === i ? { ...p, [lista]: p[lista].map((x, m) => (m === n ? { ...x, [k]: val || null } : x)) } : p)) }));
  const L = ({ r, val, on }: { r: string; val?: string | null; on: (s: string) => void }) => (
    <label className="block space-y-1"><span className="text-base font-bold">{r}</span><input className={campo} defaultValue={val ?? ""} onBlur={(e) => on(e.target.value.trim())} /></label>
  );
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSalvar(v); }}>
      {v.paises.map((p, i) => (
        <fieldset key={p.iso2} className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <legend className="px-1 text-xl font-bold">{p.pais}</legend>
          {(["geral", "policia", "ambulancia", "bombeiros", "obs"] as const).map((k) => <L key={k} r={{ geral: "Número geral", policia: "Polícia", ambulancia: "Ambulância", bombeiros: "Bombeiros", obs: "Observação" }[k]} val={p[k]} on={(s) => setPais(i, k, s)} />)}
          {(["postos", "outros"] as const).flatMap((lista) => p[lista].map((x, n) => (
            <div key={lista + n} className="space-y-2 border-t border-border pt-3">
              <p className="text-lg font-bold">{x.tipo} em {x.cidade}</p>
              <L r="Plantão 24h" val={x.plantao} on={(s) => setPosto(i, lista, n, "plantao", s)} />
              <L r="Horário comercial" val={x.telefone} on={(s) => setPosto(i, lista, n, "telefone", s)} />
              <L r="Endereço" val={x.endereco} on={(s) => setPosto(i, lista, n, "endereco", s)} />
            </div>
          )))}
        </fieldset>
      ))}
      <L r="Plantão do Itamaraty" val={v.itamaraty} on={(s) => setV((x) => ({ ...x, itamaraty: s || x.itamaraty }))} />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancelar} className="tap rounded-xl border-2 border-border text-lg font-bold">Cancelar</button>
        <button type="submit" className="tap rounded-xl bg-primary text-lg font-bold text-primary-foreground">Salvar</button>
      </div>
    </form>
  );
}
