import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { EscolherBlocos } from "@/components/EscolherBlocos";
import { aceitarConvite, verConvite } from "@/lib/compartilhar.functions";
import { TODOS_BLOCOS, nomeBloco, type Bloco } from "@/lib/blocos";

export const Route = createFileRoute("/convite/$token")({
  head: () => ({
    meta: [
      { title: "Convite — Evoque Viagens" },
      { name: "description", content: "Aceite o convite e escolha o que compartilhar." },
      { property: "og:title", content: "Convite — Evoque Viagens" },
      { property: "og:description", content: "Aceite o convite e escolha o que compartilhar." },
    ],
  }),
  component: Convite,
});

const ERROS: Record<string, string> = {
  INVALIDO: "Este link não vale. Peça um novo a quem enviou.",
  USADO: "Este link já foi usado por outra pessoa. Peça um novo.",
  VENCIDO: "Este link venceu. Peça um novo a quem enviou.",
  PROPRIO: "Este é o seu próprio link. Envie para a outra pessoa.",
};

function Convite() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const ver = useServerFn(verConvite);
  const aceitar = useServerFn(aceitarConvite);
  const { data: c, isLoading } = useQuery({ queryKey: ["convite", token], queryFn: () => ver({ data: { token } }), retry: 1 });
  const [blocos, setBlocos] = useState<Bloco[]>(TODOS_BLOCOS);
  const [trips, setTrips] = useState<string[] | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function ok(lista: Bloco[]) {
    setEnviando(true);
    try {
      await aceitar({ data: { token, blocos: lista, tripIds: trips } });
      await qc.invalidateQueries({ queryKey: ["pessoas"] });
      toast.success(lista.length ? "Pronto! Compartilhamento ativo." : "Tudo certo.");
      navigate({ to: "/" });
    } catch {
      toast.error("Não deu certo agora. Tente de novo.");
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 pb-32 pt-8">
      <div className="mx-auto max-w-md space-y-4">
        {isLoading && <p className="text-lg text-muted-foreground">Abrindo convite…</p>}
        {c && !c.ok && (
          <>
            <h1 className="text-3xl">Convite</h1>
            <p className="text-lg text-foreground">{ERROS[c.erro] ?? ERROS.INVALIDO}</p>
            <button onClick={() => navigate({ to: "/" })} className="tap w-full rounded-2xl bg-primary text-xl font-bold text-primary-foreground">
              Ir para o app
            </button>
          </>
        )}
        {c?.ok && c.direcao === "pedido" && (
          <>
            <h1 className="text-3xl">{c.deNome} quer ver seus dados de viagem</h1>
            {c.temFicha && (
              <p className="text-lg text-foreground">
                {c.deNome} já começou sua ficha. Ao aceitar, ela passa a ser sua: só você edita.
              </p>
            )}
            <p className="text-lg text-foreground">Escolha o que {c.deNome} pode ver. Dá para mudar ou revogar quando quiser.</p>
            <EscolherBlocos valor={blocos} onChange={setBlocos} tripIds={trips} onTrips={setTrips} />
            <button
              onClick={() => ok(blocos)}
              disabled={enviando}
              className="gradient-hero shadow-medium tap w-full rounded-2xl text-xl font-bold disabled:opacity-60"
            >
              {blocos.length ? "Compartilhar" : "Continuar sem compartilhar"}
            </button>
          </>
        )}
        {c?.ok && c.direcao === "oferta" && (
          <>
            <h1 className="text-3xl">{c.deNome} compartilhou dados de viagem com você</h1>
            <p className="text-lg text-foreground">Você vai ver: {c.blocos.map(nomeBloco).join(" · ")}. Só leitura.</p>
            <button
              onClick={() => ok([])}
              disabled={enviando}
              className="gradient-hero shadow-medium tap w-full rounded-2xl text-xl font-bold disabled:opacity-60"
            >
              Aceitar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
