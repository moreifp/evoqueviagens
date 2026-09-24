import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { UserPlus, BellRing } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/Chrome";
import { AvatarPessoa, LinhaStatus } from "@/components/Pessoa";
import { AGUARDANDO, fichaQuery, pessoasQuery, situacao } from "@/lib/pessoas";
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

type Filtro = "todos" | "aprovar" | "aviso";

function Pessoas() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery(pessoasQuery());
  const [filtro, setFiltro] = useState<Filtro>("todos");

  // Guarda cada ficha no aparelho para abrir sem internet.
  useEffect(() => {
    if (!data || !navigator.onLine) return;
    data.pessoas.forEach((p) => qc.prefetchQuery(fichaQuery(p.id)));
  }, [data, qc]);

  const itens = useMemo(() => {
    if (!data) return [];
    return data.pessoas.map((p) => ({ p, s: situacao(p, data.docs, data.mudancas, data.links) }));
  }, [data]);

  const contagem = {
    todos: itens.length,
    aprovar: itens.filter((i) => i.s.aprovar).length,
    aviso: itens.filter((i) => i.s.aviso).length,
  };
  const visiveis = itens.filter((i) => (filtro === "todos" ? true : filtro === "aprovar" ? i.s.aprovar : i.s.aviso));

  async function lembrar(id: string, nome: string, tel: string | null, idioma: "pt" | "en") {
    try {
      const token = await linkDaPessoa(id);
      abrirWhatsApp(tel, mensagemLembrete(idioma, nome, urlDoLink(token)));
    } catch {
      toast.error("Sem internet agora. Tente de novo quando conectar.");
    }
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="flex items-center gap-2 px-4 py-3">
        <h1 className="flex-1 text-3xl">Pessoas</h1>
        <Link
          to="/pessoas/convidar"
          className="tap flex items-center gap-2 rounded-xl bg-primary px-4 text-lg font-bold text-primary-foreground"
        >
          <UserPlus size={26} strokeWidth={2.2} />
          Convidar
        </Link>
        <Avatar />
      </header>

      <div className="flex gap-2 overflow-x-auto px-4 pb-2" role="tablist" aria-label="Filtro">
        {(
          [
            ["todos", "Todos"],
            ["aprovar", "Aprovar"],
            ["aviso", "Aviso"],
          ] as const
        ).map(([k, r]) => (
          <button
            key={k}
            role="tab"
            aria-selected={filtro === k}
            onClick={() => setFiltro(k)}
            className={`tap shrink-0 rounded-full border-2 px-5 text-base font-bold ${
              filtro === k ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-foreground"
            }`}
          >
            {r} · {contagem[k]}
          </button>
        ))}
      </div>

      <main className="space-y-3 px-4 pt-2">
        {isLoading && <p className="py-8 text-center text-lg text-muted-foreground">Carregando…</p>}
        {error && !data && (
          <p className="py-8 text-center text-lg text-muted-foreground">Sem internet e nada guardado ainda.</p>
        )}
        {data && visiveis.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center">
            <p className="text-lg font-semibold text-foreground">
              {filtro === "todos" ? "Ninguém ainda. Toque em Convidar." : "Nada por aqui."}
            </p>
          </div>
        )}
        {visiveis.map(({ p, s }) => (
          <div key={p.id} className="shadow-soft flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <Link
              to={s.aprovar && s.texto !== AGUARDANDO ? "/pessoas/$pid/conferir" : "/pessoas/$pid"}
              params={{ pid: p.id }}
              className="flex min-h-[64px] flex-1 items-center gap-3"
            >
              <AvatarPessoa nome={p.nome} foto={p.foto_url} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xl font-bold text-foreground">{p.apelido || p.nome}</span>
                <LinhaStatus nivel={s.nivel} texto={s.texto} />
              </span>
            </Link>
            {s.lembrar && (
              <button
                onClick={() => lembrar(p.id, p.apelido || p.nome.split(" ")[0]!, p.telefone, p.idioma)}
                className="tap flex shrink-0 flex-col items-center justify-center rounded-xl border-2 border-border px-3 text-foreground"
              >
                <BellRing size={24} strokeWidth={2.2} />
                <span className="text-sm font-bold">Lembrar</span>
              </button>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
