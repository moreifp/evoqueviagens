import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Send, UserX, Eye, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Topo } from "@/components/Chrome";
import { EscolherBlocos } from "@/components/EscolherBlocos";
import { pessoasQuery, type GrantRow } from "@/lib/pessoas";
import { criarConvite, mudarBlocos, revogar } from "@/lib/compartilhar.functions";
import { TODOS_BLOCOS, nomeBloco, type Bloco } from "@/lib/blocos";
import { abrirWhatsApp } from "@/lib/links";

export const Route = createFileRoute("/compartilhamentos")({
  head: () => ({
    meta: [
      { title: "Compartilhamentos — Evoque Viagens" },
      { name: "description", content: "Escolha quem vê seus dados de viagem e revogue quando quiser." },
      { property: "og:title", content: "Compartilhamentos — Evoque Viagens" },
      { property: "og:description", content: "Escolha quem vê seus dados de viagem e revogue quando quiser." },
    ],
  }),
  component: Compartilhamentos,
});

function resumo(g: GrantRow) {
  return g.blocos
    .map((b) => (b === "viagens" && g.trip_ids ? `${nomeBloco(b)} (${g.trip_ids.length})` : nomeBloco(b)))
    .join(" · ");
}

function Compartilhamentos() {
  const qc = useQueryClient();
  const { data } = useQuery(pessoasQuery());
  const convidar = useServerFn(criarConvite);
  const fnRevogar = useServerFn(revogar);
  const fnMudar = useServerFn(mudarBlocos);
  const [modo, setModo] = useState<null | "oferta" | "pedido">(null);
  const [blocos, setBlocos] = useState<Bloco[]>(TODOS_BLOCOS);
  const [link, setLink] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [edBlocos, setEdBlocos] = useState<Bloco[]>([]);
  const [trips, setTrips] = useState<string[] | null>(null);
  const [edTrips, setEdTrips] = useState<string[] | null>(null);

  const uid = data?.uid;
  const dou = (data?.grants ?? []).filter((g) => g.owner_id === uid);
  const recebo = (data?.grants ?? []).filter((g) => g.grantee_id === uid);

  async function gerar() {
    if (!modo) return;
    try {
      const r = await convidar({ data: { direcao: modo, blocos: modo === "oferta" ? blocos : TODOS_BLOCOS, tripIds: modo === "oferta" ? trips : null } });
      setLink(`${window.location.origin}/convite/${r.token}`);
    } catch {
      toast.error("Não deu certo agora. Verifique a internet.");
    }
  }

  async function cortar(g: GrantRow) {
    try {
      await fnRevogar({ data: { id: g.id } });
      toast.success("Acesso revogado");
      qc.invalidateQueries({ queryKey: ["pessoas"] });
    } catch {
      toast.error("Não deu certo agora.");
    }
  }

  async function salvarBlocos(g: GrantRow) {
    try {
      await fnMudar({ data: { id: g.id, blocos: edBlocos, tripIds: edTrips } });
      setEditando(null);
      toast.success(edBlocos.length ? "Compartilhamento atualizado" : "Acesso revogado");
      qc.invalidateQueries({ queryKey: ["pessoas"] });
    } catch {
      toast.error("Não deu certo agora.");
    }
  }

  const texto =
    modo === "oferta"
      ? `Compartilhei meus dados de viagem com você no Evoque. Abra para ver: ${link}`
      : `Oi! Compartilha seus dados de viagem comigo no Evoque? Você cria sua conta e escolhe o que mostrar: ${link}`;

  return (
    <div className="min-h-screen bg-background pb-32">
      <Topo titulo="Compartilhamentos" voltarPara="/" />
      <main className="space-y-4 px-4 pt-4">
        {!modo && (
          <div className="grid gap-3">
            <button
              onClick={() => setModo("oferta")}
              className="gradient-hero shadow-medium tap flex items-center justify-center gap-3 rounded-2xl text-xl font-bold"
            >
              <Share2 size={26} strokeWidth={2.2} />
              Compartilhar meus dados
            </button>
            <button
              onClick={() => setModo("pedido")}
              className="tap flex items-center justify-center gap-3 rounded-2xl border-2 border-border bg-card text-xl font-bold text-foreground"
            >
              <Eye size={26} strokeWidth={2.2} />
              Pedir para ver dados de alguém
            </button>
          </div>
        )}

        {modo && !link && (
          <section className="space-y-3 rounded-2xl border-2 border-border bg-card p-4">
            <h2 className="text-2xl">{modo === "oferta" ? "O que a pessoa vai ver?" : "Pedir acesso"}</h2>
            {modo === "oferta" ? (
              <EscolherBlocos valor={blocos} onChange={setBlocos} tripIds={trips} onTrips={setTrips} />
            ) : (
              <p className="text-lg text-foreground">A pessoa recebe o link, cria a conta e escolhe o que mostrar para você.</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={gerar}
                disabled={modo === "oferta" && !blocos.length}
                className="tap flex-1 rounded-xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-60"
              >
                Criar link
              </button>
              <button onClick={() => setModo(null)} className="tap rounded-xl border-2 border-border px-4 text-lg font-bold text-foreground">
                Cancelar
              </button>
            </div>
          </section>
        )}

        {modo && link && (
          <section className="space-y-3 rounded-2xl border-2 border-accent bg-card p-4">
            <p className="text-lg font-bold text-foreground">Link pronto. Vale por 30 dias e só uma pessoa pode usar.</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(link);
                  toast.success("Link copiado");
                }}
                className="tap flex items-center justify-center gap-2 rounded-xl border-2 border-border text-lg font-bold text-foreground"
              >
                <Copy size={24} strokeWidth={2.2} />
                Copiar
              </button>
              <button
                onClick={() => abrirWhatsApp(null, texto)}
                className="tap flex items-center justify-center gap-2 rounded-xl bg-primary text-lg font-bold text-primary-foreground"
              >
                <Send size={24} strokeWidth={2.2} />
                WhatsApp
              </button>
            </div>
            <button
              onClick={() => {
                setModo(null);
                setLink(null);
              }}
              className="tap w-full rounded-xl text-lg font-semibold text-accent underline"
            >
              Pronto
            </button>
          </section>
        )}

        <h2 className="pt-2 text-2xl">Compartilho com</h2>
        {!dou.length && <p className="text-lg text-muted-foreground">Ninguém vê seus dados ainda.</p>}
        {dou.map((g) => (
          <div key={g.id} className="space-y-2 rounded-2xl border border-border bg-card p-3">
            <p className="text-xl font-bold text-foreground">{g.grantee_nome ?? "Alguém"}</p>
            {editando === g.id ? (
              <>
                <EscolherBlocos valor={edBlocos} onChange={setEdBlocos} tripIds={edTrips} onTrips={setEdTrips} />
                <div className="flex gap-2">
                  <button onClick={() => salvarBlocos(g)} className="tap flex-1 rounded-xl bg-primary text-lg font-bold text-primary-foreground">
                    Salvar
                  </button>
                  <button onClick={() => setEditando(null)} className="tap rounded-xl border-2 border-border px-4 text-lg font-bold text-foreground">
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-base text-muted-foreground">{resumo(g)}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditando(g.id);
                      setEdBlocos(g.blocos as Bloco[]);
                      setEdTrips(g.trip_ids ?? null);
                    }}
                    className="tap flex-1 rounded-xl border-2 border-border text-lg font-bold text-foreground"
                  >
                    Mudar
                  </button>
                  <button
                    onClick={() => cortar(g)}
                    className="tap flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-destructive text-lg font-bold text-destructive"
                  >
                    <UserX size={24} strokeWidth={2.2} />
                    Revogar
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        <h2 className="pt-2 text-2xl">Compartilham comigo</h2>
        {!recebo.length && <p className="text-lg text-muted-foreground">Ninguém compartilhou com você ainda.</p>}
        {recebo.map((g) => (
          <div key={g.id} className="space-y-2 rounded-2xl border border-border bg-card p-3">
            <p className="text-xl font-bold text-foreground">{g.owner_nome ?? "Alguém"}</p>
            <p className="text-base text-muted-foreground">{resumo(g)}</p>
            <button onClick={() => cortar(g)} className="tap w-full rounded-xl border-2 border-border text-lg font-bold text-foreground">
              Deixar de ver
            </button>
          </div>
        ))}
      </main>
    </div>
  );
}
