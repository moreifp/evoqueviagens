import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, Eye, X } from "lucide-react";
import { avisosMeusQuery, pedidosRecebidosQuery, type AvisoMeu, type PedidoRecebido } from "@/lib/data";
import { mutar } from "@/lib/outbox";
import { naTela } from "@/lib/itens";
import { EscolherBlocos } from "./EscolherBlocos";
import { nomeBloco, type Bloco } from "@/lib/blocos";
import { dataBRCurta } from "@/lib/format";

/** Faixas âmbar de avisos do organizador. tripId limita a uma viagem. */
export function AvisosMeus({ tripId }: { tripId?: string }) {
  const qc = useQueryClient();
  const { data = [] } = useQuery(avisosMeusQuery());
  const lista = tripId ? data.filter((a) => a.trip_id === tripId) : data;
  if (!lista.length) return null;
  async function resolvi(a: AvisoMeu) {
    naTela<AvisoMeu>(qc, avisosMeusQuery().queryKey, (l) => l.filter((x) => x.id !== a.id));
    const r = await mutar({ tipo: "update", tabela: "trip_notice", id: a.id, valores: { resolvido_em: new Date().toISOString() } }).catch(() => null);
    if (r === "fila") toast("Guardado. Envia quando a internet voltar.");
  }
  return (
    <section className="space-y-3" aria-label="Avisos do organizador">
      {lista.map((a) => (
        <article key={a.id} className="rounded-[18px] border-2 border-warn bg-warn/10 p-4">
          <Link to="/trip/$id" params={{ id: a.trip_id }} className="flex gap-3 text-foreground">
            <AlertTriangle size={28} strokeWidth={2.2} className="shrink-0 text-warn" />
            <span className="flex-1">
              <strong className="block text-base uppercase tracking-wide text-warn">Aviso · {a.trip?.nome ?? "viagem"}</strong>
              <span className="text-lg font-semibold">{a.mensagem}</span>
            </span>
          </Link>
          <button onClick={() => resolvi(a)} className="tap mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-lg font-bold">
            <Check size={24} strokeWidth={2.2} /> Já resolvi
          </button>
        </article>
      ))}
    </section>
  );
}

/** "Diego quer ver seus dados · para Portugal · até 28/10". */
export function PedidosRecebidos() {
  const { data = [] } = useQuery(pedidosRecebidosQuery());
  if (!data.length) return null;
  return <section className="space-y-3" aria-label="Pedidos de dados">{data.map((p) => <PedidoCartao key={p.id} p={p} />)}</section>;
}

function PedidoCartao({ p }: { p: PedidoRecebido }) {
  const qc = useQueryClient();
  const [escolher, setEscolher] = useState(false);
  const [blocos, setBlocos] = useState<Bloco[]>(p.blocos as Bloco[]);
  async function responder(aceitar: boolean) {
    naTela<PedidoRecebido>(qc, pedidosRecebidosQuery().queryKey, (l) => l.filter((x) => x.id !== p.id));
    try {
      const r = await mutar({ tipo: "rpc", funcao: "responder_pedido", args: { _id: p.id, _blocos: aceitar ? blocos : [], _aceitar: aceitar } });
      toast.success(r === "fila" ? "Guardado. Envia quando a internet voltar." : aceitar ? "Pronto! Compartilhamento ativo." : "Pedido recusado.");
    } catch (e) {
      toast.error((e as Error).message);
      void qc.invalidateQueries({ queryKey: ["pedidos_recebidos"] });
    }
  }
  return (
    <article className="rounded-[18px] border border-border bg-card p-4 shadow-soft">
      <div className="flex gap-3">
        <Eye size={28} strokeWidth={2.2} className="shrink-0 text-accent" />
        <div className="flex-1">
          <p className="text-xl font-bold text-foreground">{p.from_nome ?? "Organizador"} quer ver seus dados</p>
          <p className="text-base font-semibold text-muted-foreground">
            {p.viagem ? `para ${p.viagem}` : ""}{p.ate ? ` · até ${dataBRCurta(new Date(new Date(p.ate).getTime() - 864e5).toISOString().slice(0, 10))}` : " · sem prazo"}{p.pessoa ? ` · ficha de ${p.pessoa}` : ""}
          </p>
          <p className="mt-2 text-base text-foreground">Pede: {p.blocos.map(nomeBloco).join(", ")}</p>
          <p className="mt-2 text-base font-semibold text-foreground">Ele só vê. Não edita nada seu. Senhas do cofre nunca vão.</p>
        </div>
      </div>
      {escolher && <div className="mt-3"><EscolherBlocos valor={blocos} onChange={setBlocos} /></div>}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button onClick={() => responder(false)} className="tap flex items-center justify-center gap-2 rounded-xl border border-border text-lg font-bold"><X size={24} /> Recusar</button>
        {escolher ? (
          <button onClick={() => responder(true)} className="tap gradient-hero flex items-center justify-center gap-2 rounded-xl text-lg font-bold"><Check size={24} /> Aceitar</button>
        ) : (
          <button onClick={() => setEscolher(true)} className="tap gradient-hero rounded-xl text-lg font-bold">Escolher e aceitar</button>
        )}
      </div>
    </article>
  );
}
