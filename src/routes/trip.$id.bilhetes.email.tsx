import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Trash2 } from "lucide-react";
import { Topo } from "@/components/Chrome";
import { Campo, inputCls } from "@/components/Form";
import { ColarEmailAgencia } from "@/components/ColarEmailAgencia";
import { casarPessoa } from "@/components/PreencherArquivo";
import { membersQuery } from "@/lib/data";
import { aviso, enviar, montarOpsVoo, novoId } from "@/lib/itens";
import { localParaUtc } from "@/lib/fuso";
import { dataLocal } from "@/lib/importAnexo";
import { carregarAeroportos, porIata } from "@/lib/aeroportos";
import { anexarPrivado, type Original } from "@/lib/emailAgencia";
import { pegarBagagem, textoBagagem, type Bagagem } from "@/lib/bagagem";
import { fusoLocal } from "@/lib/format";
import type { Trecho } from "@/lib/reserva-ai.functions";
import type { Op } from "@/lib/outbox";

export const Route = createFileRoute("/trip/$id/bilhetes/email")({
  head: () => ({
    meta: [
      { title: "E-mail da agência — Evoque Viagens" },
      { name: "description", content: "Cole o e-mail da agência e confira todos os voos antes de salvar." },
      { property: "og:title", content: "E-mail da agência — Evoque Viagens" },
      { property: "og:description", content: "Voos, passageiros e bagagem lidos do e-mail da agência." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TelaEmail,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-lg">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-lg">Viagem não encontrada.</div>,
});

type Linha = {
  id: string; tipo: string; companhia: string; numero: string; localizador: string; origem_iata: string; destino_iata: string;
  origem_cidade: string; destino_cidade: string; partida: string; chegada: string; partida_tz: string; chegada_tz: string;
  bag: Bagagem; pax: { person_id: string; nome_no_bilhete: string; assento: string; eticket: string }[]; semPar: string[];
};

function TelaEmail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: membros } = useSuspenseQuery(membersQuery(id));
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [original, setOriginal] = useState<Original | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function lido(trechos: Trecho[], o: Original) {
    const aero = await carregarAeroportos().catch(() => []);
    setOriginal(o);
    setLinhas(trechos.map((t) => {
      const oi = (t.origem_iata ?? "").toUpperCase().slice(0, 3), di = (t.destino_iata ?? "").toUpperCase().slice(0, 3);
      const a = oi ? porIata(aero, oi) : undefined, b = di ? porIata(aero, di) : undefined;
      const pax: Linha["pax"] = []; const semPar: string[] = [];
      for (const p of t.passageiros) {
        const pid = casarPessoa(p.nome, membros);
        if (pid && !pax.some((x) => x.person_id === pid)) pax.push({ person_id: pid, nome_no_bilhete: p.nome.toUpperCase(), assento: p.assento ?? "", eticket: p.eticket ?? "" });
        else if (!pid) semPar.push(p.nome);
      }
      return {
        id: novoId(), tipo: t.tipo, companhia: t.companhia ?? "", numero: t.numero ?? "", localizador: t.localizador ?? "",
        origem_iata: oi, destino_iata: di, origem_cidade: t.origem_cidade ?? a?.cidade ?? "", destino_cidade: t.destino_cidade ?? b?.cidade ?? "",
        partida: dataLocal(t.inicio), chegada: dataLocal(t.fim), partida_tz: a?.tz ?? fusoLocal(), chegada_tz: b?.tz ?? fusoLocal(),
        bag: pegarBagagem(t.bagagem), pax, semPar,
      };
    }));
  }

  const muda = (lid: string, k: keyof Linha, v: string) => setLinhas((l) => l.map((x) => (x.id === lid ? { ...x, [k]: v } : x)));

  async function salvar() {
    if (linhas.some((l) => !l.partida || !l.chegada)) return toast.error("Preencha partida e chegada de todos os trechos.");
    setSalvando(true);
    const grupo = linhas.length > 1 ? linhas.find((l) => l.localizador)?.localizador ?? null : null;
    const ops: Op[] = [];
    for (const l of linhas) {
      ops.push(...montarOpsVoo({
        tripId: id, id: l.id,
        valores: {
          tipo: l.tipo, companhia: l.companhia.trim() || null, numero: l.numero.trim() || null, localizador: l.localizador.trim() || null, grupo_reserva: grupo,
          origem_iata: l.origem_iata || null, destino_iata: l.destino_iata || null, origem_cidade: l.origem_cidade.trim() || null, destino_cidade: l.destino_cidade.trim() || null,
          partida_utc: localParaUtc(l.partida, l.partida_tz), partida_tz: l.partida_tz, chegada_utc: localParaUtc(l.chegada, l.chegada_tz), chegada_tz: l.chegada_tz,
          ...l.bag,
        },
        passageiros: l.pax.map((p) => ({ id: novoId(), person_id: p.person_id, nome_no_bilhete: p.nome_no_bilhete || null, assento: p.assento || null, eticket: p.eticket || null, ...l.bag })),
      }));
    }
    try {
      const r = await enviar(ops);
      if (original) await anexarPrivado(id, linhas.map((l) => l.id), original).catch((e: Error) => toast.error(`Voos salvos, mas o e-mail original não subiu: ${e.message}`));
      toast.success(aviso(r, `${linhas.length} bilhete${linhas.length > 1 ? "s" : ""} salvo${linhas.length > 1 ? "s" : ""}`));
      void qc.invalidateQueries({ queryKey: ["tickets", id] });
      void qc.invalidateQueries({ queryKey: ["roteiro", id] });
      navigate({ to: "/trip/$id/bilhetes", params: { id } });
    } catch (e) {
      toast.error((e as Error).message || "Não deu para salvar.");
      setSalvando(false);
    }
  }

  const nome = (pid: string) => { const m = membros.find((x) => x.person_id === pid); return m?.apelido || m?.nome || "Passageiro"; };

  return (
    <div className="min-h-screen bg-background pb-24">
      <Topo titulo="E-mail da agência" voltarPara="/trip/$id/bilhetes" voltarParams={{ id }} />
      <main className="mx-auto max-w-xl space-y-4 px-4 pt-4">
        {!linhas.length ? <ColarEmailAgencia onLido={(t, o) => void lido(t, o)} /> : (
          <>
            <p className="text-lg">Li {linhas.length} trecho{linhas.length > 1 ? "s" : ""}. Confira e toque em salvar. Nada foi gravado ainda.</p>
            {linhas.map((l, i) => (
              <section key={l.id} className="space-y-3 rounded-2xl border-2 border-border bg-card p-4">
                <div className="flex items-center justify-between"><h2 className="text-xl">Trecho {i + 1} · {l.origem_iata || "?"} → {l.destino_iata || "?"}</h2>
                  <button type="button" aria-label="Tirar trecho" onClick={() => setLinhas((x) => x.filter((y) => y.id !== l.id))} className="tap flex items-center gap-1 text-base font-bold text-destructive"><Trash2 size={22} /> Tirar</button></div>
                <div className="grid grid-cols-2 gap-3">
                  <Campo rotulo="Companhia"><input value={l.companhia} onChange={(e) => muda(l.id, "companhia", e.target.value)} className={inputCls} /></Campo>
                  <Campo rotulo="Número"><input value={l.numero} onChange={(e) => muda(l.id, "numero", e.target.value)} className={inputCls} /></Campo>
                  <Campo rotulo="De (IATA)"><input value={l.origem_iata} onChange={(e) => muda(l.id, "origem_iata", e.target.value.toUpperCase().slice(0, 3))} className={`${inputCls} mono-code`} /></Campo>
                  <Campo rotulo="Para (IATA)"><input value={l.destino_iata} onChange={(e) => muda(l.id, "destino_iata", e.target.value.toUpperCase().slice(0, 3))} className={`${inputCls} mono-code`} /></Campo>
                </div>
                <Campo rotulo={`Partida (hora local · ${l.partida_tz.split("/").pop()?.replace(/_/g, " ")})`}><input type="datetime-local" value={l.partida} onChange={(e) => muda(l.id, "partida", e.target.value)} className={inputCls} /></Campo>
                <Campo rotulo={`Chegada (hora local · ${l.chegada_tz.split("/").pop()?.replace(/_/g, " ")})`}><input type="datetime-local" value={l.chegada} onChange={(e) => muda(l.id, "chegada", e.target.value)} className={inputCls} /></Campo>
                <Campo rotulo="Localizador"><input value={l.localizador} onChange={(e) => muda(l.id, "localizador", e.target.value)} className={`${inputCls} mono-code`} /></Campo>
                {textoBagagem(l.bag) && <p className="text-lg"><strong>Bagagem:</strong> {textoBagagem(l.bag)}</p>}
                <ul className="space-y-1 text-lg">
                  {l.pax.map((p) => <li key={p.person_id}><strong>{nome(p.person_id)}</strong> · {p.assento || "sem assento"}</li>)}
                  {l.semPar.map((n) => <li key={n} className="text-muted-foreground">{n} · não está na viagem (não entra)</li>)}
                </ul>
              </section>
            ))}
            <button type="button" disabled={salvando || !linhas.length} onClick={() => void salvar()} className="gradient-hero shadow-medium tap flex w-full items-center justify-center gap-3 rounded-2xl text-xl font-bold">
              <Check size={28} strokeWidth={2.2} /> Salvar {linhas.length} bilhete{linhas.length > 1 ? "s" : ""}
            </button>
            <p className="text-base text-muted-foreground">O e-mail original fica anexado aos bilhetes, visível só para o organizador.</p>
          </>
        )}
      </main>
    </div>
  );
}
