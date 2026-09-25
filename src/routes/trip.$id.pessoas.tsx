import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, MessageCircle, Plus, Send, UserMinus, X } from "lucide-react";
import { Topo } from "@/components/Chrome";
import { convitesMembrosQuery, membersQuery, peopleQuery, pedidosQuery, tripQuery, type Membro } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { mutar } from "@/lib/outbox";
import { aviso, naTela, novoId } from "@/lib/itens";
import { dataBRCurta } from "@/lib/format";
import { Campo, inputCls } from "@/components/Form";

export const Route = createFileRoute("/trip/$id/pessoas")({
  head: () => ({
    meta: [
      { title: "Pessoas da viagem — Evoque Viagens" },
      { name: "description", content: "Quem viaja com você nesta viagem e quem já aceitou." },
      { property: "og:title", content: "Pessoas da viagem — Evoque Viagens" },
      { property: "og:description", content: "Quem viaja com você nesta viagem e quem já aceitou." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pessoas,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-lg">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-lg">Sem pessoas.</div>,
});

const iniciais = (n: string) => n.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

function estado(m: Membro): { txt: string; cls: string } {
  if (m.papel === "owner") return { txt: "Organiza", cls: "bg-secondary text-secondary-foreground" };
  if (m.kind === "precadastro") return { txt: "Sem conta", cls: "bg-warn text-warn-foreground" };
  if (m.status === "aceito") return { txt: "Aceitou", cls: "bg-ok text-ok-foreground" };
  if (m.status === "recusado") return { txt: "Recusou", cls: "bg-danger text-danger-foreground" };
  if (m.status === "saiu") return { txt: "Saiu", cls: "bg-muted text-muted-foreground" };
  return { txt: "Esperando", cls: "bg-warn text-warn-foreground" };
}

export function textoConvite(idioma: string, organizador: string, viagem: string, datas: string, link: string) {
  return idioma === "en"
    ? `Hi! ${organizador} added you to the trip "${viagem}" (${datas}) on Evoque Viagens. Create your account with this email to see your flights and hotels: ${link}`
    : `Olá! ${organizador} adicionou você à viagem "${viagem}" (${datas}) no Evoque Viagens. Crie sua conta com este e-mail para ver seus voos e hotéis: ${link}`;
}

function Pessoas() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: membros } = useSuspenseQuery(membersQuery(id));
  const { data: pessoas } = useSuspenseQuery(peopleQuery());
  const { data: trip } = useSuspenseQuery(tripQuery(id));
  const { data: convites = [] } = useQuery(convitesMembrosQuery(id));
  const { data: pedidos = [] } = useQuery(pedidosQuery(id));
  const [uid, setUid] = useState<string | null>(null);
  const [aberto, setAberto] = useState<null | "escolher" | "convidar">(null);
  useEffect(() => { void supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null)); }, []);
  const souDono = !!uid && trip.owner_id === uid;
  const key = membersQuery(id).queryKey;
  const dono = membros.find((m) => m.papel === "owner");
  const datas = `${dataBRCurta(trip.data_inicio)} a ${dataBRCurta(trip.data_fim)}`;
  const link = typeof window !== "undefined" ? window.location.origin : "https://evoqueviagens.lovable.app";

  const naViagem = new Set(membros.map((m) => m.person_id));
  const livres = pessoas.filter((p) => !naViagem.has(p.id) && p.kind !== "precadastro");
  const grupos = [
    { titulo: "Eu", lista: livres.filter((p) => p.account_id === uid && p.kind === "self") },
    { titulo: "Minha família", lista: livres.filter((p) => p.account_id === uid && p.kind === "dependent") },
    { titulo: "Quem compartilha comigo", lista: livres.filter((p) => p.account_id !== uid && p.kind === "self") },
  ];

  async function adicionar(p: (typeof pessoas)[number]) {
    const meu = p.account_id === uid;
    // O banco decide o status final (dono, dependente ou "sem perguntar" = aceito).
    const row: Membro = { id: novoId(), person_id: p.id, papel: "membro", status: meu ? "aceito" : "convidado", nome: p.nome, apelido: p.apelido ?? null, nome_como_no_documento: p.nome_como_no_documento, kind: p.kind ?? "self", meu };
    naTela<Membro>(qc, key, (l) => [...l, row]);
    try {
      const r = await mutar({ tipo: "insert", tabela: "trip_member", valores: { id: row.id, trip_id: id, person_id: p.id, papel: "membro", status: row.status } });
      toast.success(aviso(r, meu ? "Adicionado à viagem" : "Enviado · a pessoa recebe na conta dela"));
      void qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      naTela<Membro>(qc, key, (l) => l.filter((x) => x.id !== row.id));
      toast.error((e as Error).message);
    }
  }

  async function tirar(m: Membro) {
    naTela<Membro>(qc, key, (l) => l.filter((x) => x.id !== m.id));
    try {
      const r = await mutar({ tipo: "update", tabela: "trip_member", id: m.id, valores: { deleted_at: new Date().toISOString() } });
      toast(aviso(r, `${m.apelido || m.nome} saiu da viagem`), {
        duration: 10_000,
        action: { label: "Desfazer", onClick: () => { naTela<Membro>(qc, key, (l) => [...l, m]); void mutar({ tipo: "update", tabela: "trip_member", id: m.id, valores: { deleted_at: null } }); } },
      });
    } catch (e) {
      naTela<Membro>(qc, key, (l) => [...l, m]);
      toast.error((e as Error).message);
    }
  }

  function lembrar(m: Membro, via: "whatsapp" | "email") {
    const c = convites.find((x) => x.id === m.id);
    const txt = textoConvite(c?.convite_idioma ?? "pt", dono?.nome ?? "Seu organizador", trip.nome, datas, link);
    if (via === "whatsapp") {
      const tel = (c?.convite_telefone ?? "").replace(/\D/g, "");
      window.open(`https://api.whatsapp.com/send?${tel ? `phone=${tel}&` : ""}text=${encodeURIComponent(txt)}`, "_blank", "noopener");
    } else {
      window.location.href = `mailto:${c?.convite_email ?? ""}?subject=${encodeURIComponent(trip.nome)}&body=${encodeURIComponent(txt)}`;
    }
    void mutar({ tipo: "update", tabela: "trip_member", id: m.id, valores: { lembrado_em: new Date().toISOString() } }).catch(() => null);
  }

  async function resolverPedido(pid: string) {
    naTela<{ id: string; resolvido_em: string | null }>(qc, pedidosQuery(id).queryKey, (l) => l.map((x) => (x.id === pid ? { ...x, resolvido_em: new Date().toISOString() } : x)));
    await mutar({ tipo: "update", tabela: "trip_notice", id: pid, valores: { resolvido_em: new Date().toISOString() } }).catch((e) => toast.error((e as Error).message));
  }

  return (
    <>
      <Topo titulo="Pessoas" voltarPara="/trip/$id" voltarParams={{ id }} />
      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-4 pb-28">
        {souDono && pedidos.filter((p) => !p.resolvido_em).map((p) => (
          <article key={p.id} className="rounded-[18px] border-2 border-warn bg-card p-4">
            <p className="text-base font-bold text-muted-foreground">Pedido de correção · {membros.find((m) => m.person_id === p.person_id)?.nome ?? "Participante"}</p>
            <p className="mt-1 text-lg">{p.mensagem}</p>
            <button onClick={() => void resolverPedido(p.id)} className="tap mt-2 text-lg font-bold text-accent">Resolvido</button>
          </article>
        ))}

        {membros.map((m) => {
          const e = estado(m);
          const semConta = m.kind === "precadastro";
          return (
            <article key={m.id} className="shadow-soft overflow-hidden rounded-[18px] border border-border bg-card">
              <div className="flex items-center gap-4 p-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-bold text-secondary-foreground">{iniciais(m.apelido || m.nome)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xl font-bold">{m.apelido || m.nome}{m.kind === "dependent" ? " · dependente" : ""}</p>
                  <span className={`mt-1 inline-block rounded-full px-3 py-1 text-base font-bold ${e.cls}`}>{e.txt}</span>
                </div>
              </div>
              {souDono && semConta && (
                <div className="grid grid-cols-2 border-t border-border">
                  <button onClick={() => lembrar(m, "whatsapp")} className="tap flex items-center justify-center gap-2 text-lg font-bold text-accent"><MessageCircle size={24} strokeWidth={2.2} /> Lembrar</button>
                  <button onClick={() => lembrar(m, "email")} className="tap flex items-center justify-center gap-2 border-l border-border text-lg font-bold text-accent"><Mail size={24} strokeWidth={2.2} /> E-mail</button>
                </div>
              )}
              {souDono && m.papel !== "owner" && (
                <button onClick={() => void tirar(m)} className="tap flex w-full items-center justify-center gap-2 border-t border-border text-lg font-bold text-destructive"><UserMinus size={24} strokeWidth={2.2} /> Tirar da viagem</button>
              )}
            </article>
          );
        })}

        {souDono && !aberto && (
          <button onClick={() => setAberto("escolher")} className="tap flex w-full items-center justify-center gap-3 rounded-[18px] border-2 border-accent text-xl font-bold text-accent"><Plus size={28} strokeWidth={2.2} /> Adicionar participante</button>
        )}

        {souDono && aberto === "escolher" && (
          <section className="space-y-5 rounded-[18px] border border-border bg-card p-4">
            <div className="flex items-center"><h2 className="flex-1 text-2xl">Quem vai?</h2><button aria-label="Fechar" onClick={() => setAberto(null)} className="tap flex w-14 items-center justify-center"><X size={28} /></button></div>
            {grupos.map((g) => g.lista.length > 0 && (
              <div key={g.titulo}>
                <h3 className="mb-2 text-lg font-extrabold uppercase text-muted-foreground">{g.titulo}</h3>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {g.lista.map((p) => (
                    <button key={p.id} onClick={() => void adicionar(p)} className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-[18px] border border-border p-2 text-center">
                      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-2xl font-bold text-secondary-foreground">{iniciais(p.apelido || p.nome)}</span>
                      <span className="line-clamp-2 text-lg font-bold">{g.titulo === "Eu" ? "Eu" : p.apelido || p.nome}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {grupos.every((g) => g.lista.length === 0) && <p className="text-lg">Todos que você vê já estão na viagem. Dependentes são cadastrados em <Link to="/" className="font-bold text-accent underline">Eu</Link>.</p>}
            <button onClick={() => setAberto("convidar")} className="gradient-hero tap flex w-full items-center justify-center gap-3 rounded-[18px] text-xl font-bold"><Send size={26} strokeWidth={2.2} /> Convidar quem não tem conta</button>
          </section>
        )}

        {souDono && aberto === "convidar" && (
          <Convidar tripId={id} onFim={() => setAberto(null)} texto={(idioma) => textoConvite(idioma, dono?.nome ?? "Seu organizador", trip.nome, datas, link)} />
        )}
      </main>
    </>
  );
}

function Convidar({ tripId, onFim, texto }: { tripId: string; onFim: () => void; texto: (idioma: string) => string }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [tel, setTel] = useState("");
  const [idioma, setIdioma] = useState("pt");
  const [enviando, setEnviando] = useState(false);

  async function convidar(via: "whatsapp" | "email") {
    if (!nome.trim() || (via === "email" ? !email.trim() : !tel.trim())) { toast.error(via === "email" ? "Informe nome e e-mail." : "Informe nome e WhatsApp."); return; }
    setEnviando(true);
    const member = novoId(), person = novoId();
    const row: Membro = { id: member, person_id: person, papel: "membro", status: "convidado", nome: nome.trim(), apelido: null, nome_como_no_documento: null, kind: "precadastro", meu: false };
    naTela<Membro>(qc, membersQuery(tripId).queryKey, (l) => [...l, row]);
    try {
      const r = await mutar({ tipo: "rpc", funcao: "convidar_sem_conta", args: { _trip: tripId, _member: member, _person: person, _nome: nome, _email: email, _telefone: tel, _idioma: idioma } });
      const txt = texto(idioma);
      if (via === "whatsapp") window.open(`https://api.whatsapp.com/send?phone=${tel.replace(/\D/g, "")}&text=${encodeURIComponent(txt)}`, "_blank", "noopener");
      else window.location.href = `mailto:${email.trim()}?subject=${encodeURIComponent("Evoque Viagens")}&body=${encodeURIComponent(txt)}`;
      toast.success(aviso(r, "Convite registrado"));
      void qc.invalidateQueries({ queryKey: convitesMembrosQuery(tripId).queryKey });
      onFim();
    } catch (e) {
      naTela<Membro>(qc, membersQuery(tripId).queryKey, (l) => l.filter((x) => x.id !== member));
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="space-y-4 rounded-[18px] border border-border bg-card p-4">
      <div className="flex items-center"><h2 className="flex-1 text-2xl">Convidar</h2><button aria-label="Fechar" onClick={onFim} className="tap flex w-14 items-center justify-center"><X size={28} /></button></div>
      <Campo rotulo="Nome"><input value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} /></Campo>
      <Campo rotulo="E-mail"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></Campo>
      <Campo rotulo="WhatsApp com DDI"><input type="tel" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="+55 11 99999-9999" className={inputCls} /></Campo>
      <Campo rotulo="Idioma da mensagem">
        <select value={idioma} onChange={(e) => setIdioma(e.target.value)} className={inputCls}><option value="pt">Português</option><option value="en">English</option></select>
      </Campo>
      <p className="text-base text-muted-foreground">Quem criar a conta com este e-mail verá a viagem esperando aceite.</p>
      <div className="grid grid-cols-2 gap-3">
        <button disabled={enviando} onClick={() => void convidar("whatsapp")} className="tap flex items-center justify-center gap-2 rounded-[18px] bg-primary text-lg font-bold text-primary-foreground"><MessageCircle size={24} /> WhatsApp</button>
        <button disabled={enviando} onClick={() => void convidar("email")} className="tap flex items-center justify-center gap-2 rounded-[18px] border-2 border-accent text-lg font-bold text-accent"><Mail size={24} /> E-mail</button>
      </div>
    </section>
  );
}
