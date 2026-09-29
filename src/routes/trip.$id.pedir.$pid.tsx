import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Topo } from "@/components/Chrome";
import { conferirQuery, tripQuery } from "@/lib/data";
import { mutar } from "@/lib/outbox";
import { abrirWhatsApp } from "@/lib/links";
import { br } from "@/lib/conferencia";
import { origemApp } from "@/lib/site";

export const Route = createFileRoute("/trip/$id/pedir/$pid")({
  head: () => ({
    meta: [
      { title: "Pedir dados — Evoque Viagens" },
      {
        name: "description",
        content: "Peça ao participante para liberar os dados que a viagem precisa.",
      },
      { property: "og:title", content: "Pedir dados" },
      {
        property: "og:description",
        content: "Peça ao participante para liberar os dados que a viagem precisa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pedir,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-lg">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-lg">Pessoa não encontrada.</div>,
});

const OPCOES = [
  { id: "documentos", nome: "Documentos", desc: "Passaporte, vistos, vacina e seguro" },
  { id: "fidelidade", nome: "Fidelidade", desc: "Milhas e programas" },
  { id: "preferencias", nome: "Preferências", desc: "Assento, quarto, refeição" },
  { id: "basico", nome: "Emergência e cadastro básico", desc: "Contato de emergência, endereço" },
];

function Pedir() {
  const { id, pid } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: trip } = useQuery(tripQuery(id));
  const { data: lista = [] } = useQuery(conferirQuery(id));
  const pessoa = lista.find((c) => c.person_id === pid);
  const [blocos, setBlocos] = useState<string[]>(["documentos", "fidelidade", "preferencias"]);
  const [ateFim, setAteFim] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const nome = pessoa?.nome.split(" ")[0] ?? "participante";

  async function pedir(whats: boolean) {
    if (!blocos.length || !trip) return;
    setEnviando(true);
    try {
      const r = await mutar({
        tipo: "rpc",
        funcao: "pedir_dados",
        args: {
          _id: crypto.randomUUID(),
          _trip: id,
          _person: pid,
          _blocos: blocos,
          _ate_fim: ateFim,
        },
      });
      if (whats)
        abrirWhatsApp(
          pessoa?.convite_telefone ?? null,
          `Oi, ${nome}! Para ${trip.nome} preciso conferir seus dados de viagem. Abra o Evoque e toque em "Escolher e aceitar": ${origemApp()}/viagens`,
        );
      toast.success(
        r === "fila" ? "Guardado. Envia quando a internet voltar." : `Pedido enviado para ${nome}.`,
      );
      await qc.invalidateQueries({ queryKey: ["conferir", id] });
      navigate({ to: "/trip/$id/revisao", params: { id } });
    } catch (e) {
      toast.error((e as Error).message);
      setEnviando(false);
    }
  }

  return (
    <>
      <Topo titulo={`Pedir para ${nome}`} voltarPara="/trip/$id/revisao" voltarParams={{ id }} />
      <main className="mx-auto max-w-xl space-y-6 px-4 pb-32 pt-4">
        <section className="space-y-2">
          <h2 className="text-2xl">O que você precisa ver</h2>
          {OPCOES.map((o) => {
            const on = blocos.includes(o.id);
            return (
              <button
                key={o.id}
                role="checkbox"
                aria-checked={on}
                onClick={() => setBlocos((b) => (on ? b.filter((x) => x !== o.id) : [...b, o.id]))}
                className="tap flex w-full items-center gap-3 rounded-[18px] border border-border bg-card p-4 text-left"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 ${on ? "border-accent bg-accent text-accent-foreground" : "border-border"}`}
                >
                  {on && <Check size={22} />}
                </span>
                <span>
                  <strong className="block text-lg">{o.nome}</strong>
                  <span className="text-base text-muted-foreground">{o.desc}</span>
                </span>
              </button>
            );
          })}
        </section>
        <section className="space-y-2">
          <h2 className="text-2xl">Por quanto tempo</h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              aria-pressed={ateFim}
              onClick={() => setAteFim(true)}
              className={`tap rounded-xl text-lg font-bold ${ateFim ? "bg-primary text-primary-foreground" : "border border-border"}`}
            >
              Até o fim da viagem{trip ? ` (${br(trip.data_fim)})` : ""}
            </button>
            <button
              aria-pressed={!ateFim}
              onClick={() => setAteFim(false)}
              className={`tap rounded-xl text-lg font-bold ${!ateFim ? "bg-primary text-primary-foreground" : "border border-border"}`}
            >
              Sempre
            </button>
          </div>
        </section>
        <p className="text-base text-muted-foreground">
          {nome} escolhe o que libera. Você só vê, não edita nada. Senhas do cofre nunca vão.
        </p>
        <div className="grid gap-3">
          <button
            disabled={enviando || !blocos.length}
            onClick={() => pedir(false)}
            className="tap gradient-hero rounded-xl text-lg font-bold disabled:opacity-60"
          >
            Pedir no app
          </button>
          <button
            disabled={enviando || !blocos.length}
            onClick={() => pedir(true)}
            className="tap rounded-xl border border-border text-lg font-bold disabled:opacity-60"
          >
            Pedir no app e avisar pelo WhatsApp
          </button>
        </div>
      </main>
    </>
  );
}
