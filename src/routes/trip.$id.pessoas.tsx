import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, UserRound, UserMinus } from "lucide-react";
import { Topo } from "@/components/Chrome";
import { membersQuery, peopleQuery, type Membro } from "@/lib/data";
import { mutar } from "@/lib/outbox";
import { aviso, naTela, novoId } from "@/lib/itens";

export const Route = createFileRoute("/trip/$id/pessoas")({
  head: () => ({
    meta: [
      { title: "Pessoas da viagem — Evoque Viagens" },
      { name: "description", content: "Quem viaja com você nesta viagem." },
      { property: "og:title", content: "Pessoas da viagem — Evoque Viagens" },
      { property: "og:description", content: "Quem viaja com você nesta viagem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pessoas,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-lg">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-lg">Sem pessoas.</div>,
});

const STATUS: Record<string, string> = { aceito: "Na viagem", convidado: "Convidado · ainda não aceitou", recusado: "Recusou", saiu: "Saiu da viagem" };

function Pessoas() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: membros } = useSuspenseQuery(membersQuery(id));
  const { data: pessoas } = useSuspenseQuery(peopleQuery());
  const [adicionando, setAdicionando] = useState(false);
  const souDono = membros.some((m) => m.papel === "owner" && m.meu);
  const key = membersQuery(id).queryKey;

  const naViagem = new Set(membros.map((m) => m.person_id));
  const candidatos = pessoas.filter((p) => !naViagem.has(p.id) && p.kind !== "precadastro");

  async function adicionar(p: (typeof pessoas)[number]) {
    const meu = !!p.account_id && membros.some((m) => m.meu) ? pessoas.find((x) => x.kind === "self")?.account_id === p.account_id : false;
    const status = meu ? "aceito" : "convidado";
    const row: Membro = { id: novoId(), person_id: p.id, papel: "membro", status, nome: p.nome, apelido: p.apelido ?? null, nome_como_no_documento: p.nome_como_no_documento, kind: p.kind ?? "self", meu };
    naTela<Membro>(qc, key, (l) => [...l, row]);
    setAdicionando(false);
    try {
      const r = await mutar({ tipo: "insert", tabela: "trip_member", valores: { id: row.id, trip_id: id, person_id: p.id, papel: "membro", status } });
      toast.success(aviso(r, status === "aceito" ? "Adicionado à viagem" : "Convite registrado"));
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
        action: {
          label: "Desfazer",
          onClick: () => {
            naTela<Membro>(qc, key, (l) => [...l, m]);
            void mutar({ tipo: "update", tabela: "trip_member", id: m.id, valores: { deleted_at: null } });
          },
        },
      });
    } catch (e) {
      naTela<Membro>(qc, key, (l) => [...l, m]);
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <Topo titulo="Pessoas" voltarPara="/trip/$id" voltarParams={{ id }} />
      <main className="space-y-4 px-4 pt-4">
        {membros.map((m) => (
          <article key={m.id} className="shadow-soft overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-4 p-4">
              <UserRound size={28} strokeWidth={2.2} className="text-accent" />
              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold text-foreground">
                  {m.apelido || m.nome}
                  {m.papel === "owner" ? " · organiza" : ""}
                  {m.kind === "dependent" ? " · dependente" : ""}
                </p>
                <p className="text-base font-semibold text-muted-foreground">{STATUS[m.status] ?? m.status}</p>
              </div>
            </div>
            {souDono && m.papel !== "owner" && (
              <button onClick={() => void tirar(m)} className="tap flex w-full items-center justify-center gap-2 border-t border-border text-lg font-bold text-destructive">
                <UserMinus size={24} strokeWidth={2.2} /> Tirar da viagem
              </button>
            )}
          </article>
        ))}

        {souDono &&
          (!adicionando ? (
            <button onClick={() => setAdicionando(true)} className="tap flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-accent text-xl font-bold text-accent">
              <Plus size={28} strokeWidth={2.2} />
              Adicionar pessoa
            </button>
          ) : (
            <section className="space-y-3">
              {candidatos.length === 0 && (
                <p className="text-lg">
                  Todo mundo que você vê já está na viagem. Para incluir um filho, cadastre em{" "}
                  <Link to="/" className="font-bold text-accent underline">
                    Eu · Família
                  </Link>
                  .
                </p>
              )}
              {candidatos.map((p) => (
                <button key={p.id} onClick={() => void adicionar(p)} className="tap flex w-full items-center gap-3 rounded-2xl border-2 border-accent bg-card px-4 text-left text-xl font-bold">
                  <Plus size={24} strokeWidth={2.2} className="text-accent" />
                  {p.apelido || p.nome}
                  {p.kind === "dependent" ? " · dependente" : ""}
                </button>
              ))}
            </section>
          ))}
      </main>
    </>
  );
}
