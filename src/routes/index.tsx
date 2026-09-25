import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { UserPlus, BellRing, Baby, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Chrome";
import { AvatarPessoa, LinhaStatus } from "@/components/Pessoa";
import { AGUARDANDO, fichaQuery, pessoasQuery, situacao, type PessoaRow } from "@/lib/pessoas";
import { abrirWhatsApp, linkDaPessoa, mensagemLembrete, urlDoLink } from "@/lib/links";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pessoas — Evoque Viagens" },
      { name: "description", content: "Cadastro de viagem de cada pessoa: passaporte, vistos, fidelidade e emergência." },
      { property: "og:title", content: "Pessoas — Evoque Viagens" },
      { property: "og:description", content: "Cadastro de viagem de cada pessoa, pronto para abrir no aeroporto." },
    ],
  }),
  component: Pessoas,
});

type Item = { p: PessoaRow; s: ReturnType<typeof situacao> };

function Pessoas() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery(pessoasQuery());
  const [criando, setCriando] = useState(false);

  // Guarda cada ficha no aparelho para abrir sem internet.
  useEffect(() => {
    if (!data || !navigator.onLine) return;
    data.pessoas.forEach((p) => qc.prefetchQuery(fichaQuery(p.id)));
  }, [data, qc]);

  const grupos = useMemo(() => {
    const vazio = { eu: [] as Item[], familia: [] as Item[], pre: [] as Item[], comigo: new Map<string, Item[]>() };
    if (!data) return vazio;
    for (const p of data.pessoas) {
      const it = { p, s: situacao(p, data.docs, data.mudancas, data.links) };
      if (p.account_id === data.uid) {
        if (p.kind === "self") vazio.eu.push(it);
        else if (p.kind === "precadastro") vazio.pre.push(it);
        else vazio.familia.push(it);
      } else if (p.account_id) {
        const l = vazio.comigo.get(p.account_id) ?? [];
        l.push(it);
        vazio.comigo.set(p.account_id, l);
      }
    }
    return vazio;
  }, [data]);

  async function lembrar(id: string, nome: string, tel: string | null, idioma: "pt" | "en") {
    try {
      const token = await linkDaPessoa(id);
      abrirWhatsApp(tel, mensagemLembrete(idioma, nome, urlDoLink(token)));
    } catch {
      toast.error("Sem internet agora. Tente de novo quando conectar.");
    }
  }

  async function novoDependente() {
    if (criando) return;
    const nome = window.prompt("Nome do dependente (ex.: sua filha)");
    if (!nome?.trim()) return;
    setCriando(true);
    const { data: nova, error: e } = await supabase
      .from("person")
      .insert({ nome: nome.trim(), apelido: nome.trim().split(" ")[0], kind: "dependent", status: "em_andamento" })
      .select("id")
      .single();
    setCriando(false);
    if (e || !nova) {
      toast.error("Não deu certo agora. Tente de novo.");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["pessoas"] });
    navigate({ to: "/pessoas/$pid", params: { pid: nova.id } });
  }

  const cartao = ({ p, s }: Item, meu: boolean, pre = false) => (
    <div key={p.id} className="shadow-soft flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <Link
        to={meu && s.aprovar && s.texto !== AGUARDANDO ? "/pessoas/$pid/conferir" : "/pessoas/$pid"}
        params={{ pid: p.id }}
        className="flex min-h-[64px] flex-1 items-center gap-3"
      >
        <AvatarPessoa nome={p.nome} foto={p.foto_url} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xl font-bold text-foreground">{p.apelido || p.nome}</span>
          {meu ? <LinhaStatus nivel={s.nivel} texto={s.texto} /> : <span className="text-base text-muted-foreground">Só leitura</span>}
        </span>
      </Link>
      {pre && s.lembrar && (
        <button
          onClick={() => lembrar(p.id, p.apelido || p.nome.split(" ")[0]!, p.telefone, p.idioma)}
          className="tap flex shrink-0 flex-col items-center justify-center rounded-xl border-2 border-border px-3 text-foreground"
        >
          <BellRing size={24} strokeWidth={2.2} />
          <span className="text-sm font-bold">Lembrar</span>
        </button>
      )}
    </div>
  );

  const titulo = (t: string, sub?: string) => (
    <div className="pt-4">
      <h2 className="text-2xl text-foreground">{t}</h2>
      {sub && <p className="text-base text-muted-foreground">{sub}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="flex items-center gap-2 px-4 py-3">
        <h1 className="flex-1 text-3xl">Pessoas</h1>
        <Link
          to="/compartilhamentos"
          className="tap flex items-center gap-2 rounded-xl bg-primary px-4 text-lg font-bold text-primary-foreground"
        >
          <Share2 size={26} strokeWidth={2.2} />
          Compartilhar
        </Link>
        <Avatar />
      </header>

      <main className="space-y-3 px-4">
        {isLoading && <p className="py-8 text-center text-lg text-muted-foreground">Carregando…</p>}
        {error && !data && <p className="py-8 text-center text-lg text-muted-foreground">Sem internet e nada guardado ainda.</p>}

        {data && (
          <>
            {titulo("Eu")}
            {grupos.eu.length ? grupos.eu.map((i) => cartao(i, true)) : <p className="text-lg text-muted-foreground">Preparando sua ficha…</p>}

            {titulo("Minha família", "Dependentes sem login próprio, geridos por você.")}
            {grupos.familia.map((i) => cartao(i, true))}
            <button
              onClick={novoDependente}
              disabled={criando}
              className="tap flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-lg font-bold text-foreground"
            >
              <Baby size={26} strokeWidth={2.2} />
              Adicionar dependente
            </button>

            {[...grupos.comigo.entries()].map(([dono, itens]) => {
              const g = data.grants.find((x) => x.owner_id === dono);
              return (
                <div key={dono} className="space-y-3">
                  {titulo(`Compartilhado por ${g?.owner_nome ?? "alguém"}`)}
                  {itens.map((i) => cartao(i, false))}
                </div>
              );
            })}

            {titulo("Pré-cadastros", "Pessoas convidadas que ainda não criaram a conta.")}
            {grupos.pre.map((i) => cartao(i, true, true))}
            <Link
              to="/pessoas/convidar"
              className="tap flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-lg font-bold text-foreground"
            >
              <UserPlus size={26} strokeWidth={2.2} />
              Convidar pessoa
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
