import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Plus, UserRound } from "lucide-react";
import { Topo } from "@/components/Chrome";
import { insertRow, membersQuery, peopleQuery } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { inputCls } from "@/components/Form";

export const Route = createFileRoute("/trip/$id/pessoas")({
  head: () => ({
    meta: [
      { title: "Pessoas — Evoque Viagens" },
      { name: "description", content: "Quem viaja com você e o que já está cadastrado." },
      { property: "og:title", content: "Pessoas" },
      { property: "og:description", content: "Quem viaja com você e o que já está cadastrado." },
    ],
  }),
  component: Pessoas,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-lg">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-lg">Sem pessoas.</div>,
});

function Pessoas() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: membros } = useSuspenseQuery(membersQuery(id));
  const { data: pessoas } = useSuspenseQuery(peopleQuery());
  const [busca, setBusca] = useState("");
  const [adicionando, setAdicionando] = useState(false);

  const jaNaViagem = new Set(membros.map((m) => m.person?.id));
  const candidatos = pessoas.filter(
    (p) => !jaNaViagem.has(p.id) && p.nome.toLowerCase().includes(busca.toLowerCase()),
  );
  const existeIgual = pessoas.some((p) => p.nome.toLowerCase() === busca.trim().toLowerCase());

  async function vincular(personId: string) {
    await insertRow("trip_member", { trip_id: id, person_id: personId, papel: "membro" });
    await qc.invalidateQueries({ queryKey: ["members", id] });
    setBusca("");
    setAdicionando(false);
  }

  async function criarEvincular() {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const p = (await insertRow("person", {
        owner_id: auth.user?.id,
        nome: busca.trim(),
      })) as { id: string };
      await qc.invalidateQueries({ queryKey: ["people"] });
      await vincular(p.id);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <Topo titulo="Pessoas" voltarPara="/trip/$id" voltarParams={{ id }} />
      <main className="space-y-4 px-4 pt-4">
        {membros.map((m) => (
          <article key={m.id} className="shadow-soft flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
            <UserRound size={28} strokeWidth={2.2} className="text-accent" />
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold text-foreground">{m.person?.nome}</p>
              <p className="text-base font-semibold text-muted-foreground">
                {m.person?.nome_como_no_documento ?? "Sem nome de documento"}
              </p>
            </div>
          </article>
        ))}

        {!adicionando ? (
          <button
            onClick={() => setAdicionando(true)}
            className="tap flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-accent text-xl font-bold text-accent"
          >
            <Plus size={28} strokeWidth={2.2} />
            Adicionar pessoa
          </button>
        ) : (
          <section className="space-y-3">
            <input
              autoFocus
              placeholder="Nome"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className={inputCls}
            />
            {candidatos.map((p) => (
              <article key={p.id} className="shadow-soft rounded-2xl border-2 border-accent bg-card p-4">
                <p className="text-xl font-bold text-foreground">{p.nome}</p>
                <p className="text-base font-semibold text-muted-foreground">
                  {p.nome_como_no_documento ?? "Documento não cadastrado"}
                </p>
                {p.data_nascimento && (
                  <p className="text-base font-semibold text-muted-foreground">
                    Nasceu em {p.data_nascimento}
                  </p>
                )}
                <button
                  onClick={() => vincular(p.id)}
                  className="gradient-hero tap mt-3 flex w-full items-center justify-center gap-3 rounded-xl text-lg font-bold"
                >
                  <Check size={28} strokeWidth={2.2} />
                  Está tudo certo
                </button>
              </article>
            ))}
            {busca.trim().length > 1 && !existeIgual && (
              <button
                onClick={criarEvincular}
                className="tap w-full rounded-2xl border-2 border-border text-lg font-bold text-foreground"
              >
                Cadastrar “{busca.trim()}”
              </button>
            )}
          </section>
        )}
      </main>
    </>
  );
}
