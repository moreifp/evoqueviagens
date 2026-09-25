import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Plus, Trash2 } from "lucide-react";
import { membersQuery, roteiroQuery, ticketsQuery, type ItemRoteiro, type Passageiro, type Ticket } from "@/lib/data";
import { fusoLocal } from "@/lib/format";
import { localParaUtc, utcParaLocal } from "@/lib/fuso";
import { aviso, montarOpsVoo, enviar, naTela, noRoteiro, novoId } from "@/lib/itens";
import { achadosDoCache, avisarNovoAchado } from "@/lib/auditoria";
import { Campo, inputCls } from "@/components/Form";
import { CampoAeroporto } from "@/components/CampoAeroporto";
import { TrocarFuso } from "@/components/TrocarFuso";
import type { Op } from "@/lib/outbox";
import { baixa, lerEdicao } from "@/lib/caixaClaude";
import { anexarImportado, dataLocal } from "@/lib/importAnexo";
import { carregarAeroportos, porIata } from "@/lib/aeroportos";

type Pax = { id: string; person_id: string; nome_no_bilhete: string; assento: string; eticket: string };

export function FormBilhete({ tripId, inicial, copiarDe }: { tripId: string; inicial?: Ticket; copiarDe?: Ticket }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: membros } = useSuspenseQuery(membersQuery(tripId));
  const ativos = membros.filter((m) => m.status !== "recusado" && m.status !== "saiu");
  const [f, setF] = useState(() => ({
    tipo: inicial?.tipo ?? "voo",
    companhia: inicial?.companhia ?? "",
    numero: inicial?.numero ?? "",
    localizador: inicial?.localizador ?? "",
    grupo_reserva: inicial?.grupo_reserva ?? copiarDe?.grupo_reserva ?? "",
    origem_iata: inicial?.origem_iata ?? "",
    destino_iata: inicial?.destino_iata ?? "",
    origem_cidade: inicial?.origem_cidade ?? "",
    destino_cidade: inicial?.destino_cidade ?? "",
    partida_tz: inicial?.partida_tz ?? fusoLocal(),
    chegada_tz: inicial?.chegada_tz ?? fusoLocal(),
    partida: inicial ? utcParaLocal(inicial.partida_utc, inicial.partida_tz) : "",
    chegada: inicial ? utcParaLocal(inicial.chegada_utc, inicial.chegada_tz) : "",
  }));
  const [pax, setPax] = useState<Pax[]>(() =>
    (inicial?.passageiros ?? copiarDe?.passageiros ?? []).map((p) => ({
      id: inicial ? p.id : novoId(),
      person_id: p.person_id,
      nome_no_bilhete: p.nome_no_bilhete ?? "",
      assento: p.assento ?? "",
      eticket: p.eticket ?? "",
    })),
  );
  const [salvando, setSalvando] = useState(false);
  const [claude, setClaude] = useState<{ inboxId: string; id: string } | null>(null);
  useEffect(() => {
    if (inicial) return;
    const ed = lerEdicao(tripId, "voo");
    if (ed) {
      const p = ed.payload as unknown as { id: string; valores: Ticket; passageiros: Passageiro[] };
      const v = p.valores;
      setClaude({ inboxId: ed.inboxId, id: p.id });
      setF({ tipo: v.tipo, companhia: v.companhia ?? "", numero: v.numero ?? "", localizador: v.localizador ?? "", grupo_reserva: v.grupo_reserva ?? "", origem_iata: v.origem_iata ?? "", destino_iata: v.destino_iata ?? "", origem_cidade: v.origem_cidade ?? "", destino_cidade: v.destino_cidade ?? "", partida_tz: v.partida_tz, chegada_tz: v.chegada_tz, partida: utcParaLocal(v.partida_utc, v.partida_tz), chegada: utcParaLocal(v.chegada_utc, v.chegada_tz) });
      setPax(p.passageiros.map((x) => ({ id: x.id, person_id: x.person_id, nome_no_bilhete: x.nome_no_bilhete ?? "", assento: x.assento ?? "", eticket: x.eticket ?? "" })));
      return;
    }
    const raw = sessionStorage.getItem(`evoque-import-${tripId}`); if (!raw) return;
    sessionStorage.removeItem(`evoque-import-${tripId}`);
    const x = JSON.parse(raw) as Record<string, string | null>;
    const origem = (x.origem_iata ?? "").toUpperCase().slice(0, 3);
    const destino = (x.destino_iata ?? "").toUpperCase().slice(0, 3);
    setF((v) => ({ ...v, tipo: x.tipo === "trem" || x.tipo === "onibus" ? x.tipo : "voo", companhia: x.companhia ?? "", numero: x.numero ?? "", localizador: x.localizador ?? "", origem_iata: origem, destino_iata: destino, origem_cidade: x.origem_cidade ?? "", destino_cidade: x.destino_cidade ?? "", partida: dataLocal(x.inicio), chegada: dataLocal(x.fim) }));
    // Fuso vem do aeroporto: sem isso a hora lida seria gravada no fuso do aparelho.
    void carregarAeroportos().then((lista) => {
      const o = origem ? porIata(lista, origem) : undefined;
      const d = destino ? porIata(lista, destino) : undefined;
      setF((v) => ({ ...v, partida_tz: o?.tz ?? v.partida_tz, chegada_tz: d?.tz ?? v.chegada_tz, origem_cidade: v.origem_cidade || o?.cidade || "", destino_cidade: v.destino_cidade || d?.cidade || "" }));
    }).catch(() => undefined);
  }, [inicial, tripId]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((v) => ({ ...v, [k]: e.target.value }));
  const nomeDoc = (pid: string) => {
    const m = membros.find((x) => x.person_id === pid);
    return m ? m.nome_como_no_documento || m.nome : "";
  };

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.partida || !f.chegada) return toast.error("Preencha partida e chegada.");
    setSalvando(true);
    const antesAchados = achadosDoCache(qc, tripId);
    const id = inicial?.id ?? claude?.id ?? novoId();
    const valores = {
      tipo: f.tipo,
      companhia: f.companhia.trim() || null,
      numero: f.numero.trim() || null,
      localizador: f.localizador.trim() || null,
      grupo_reserva: f.grupo_reserva.trim() || null,
      origem_iata: f.origem_iata ? f.origem_iata.toUpperCase().slice(0, 3) : null,
      destino_iata: f.destino_iata ? f.destino_iata.toUpperCase().slice(0, 3) : null,
      origem_cidade: f.origem_cidade.trim() || null,
      destino_cidade: f.destino_cidade.trim() || null,
      partida_utc: localParaUtc(f.partida, f.partida_tz),
      partida_tz: f.partida_tz,
      chegada_utc: localParaUtc(f.chegada, f.chegada_tz),
      chegada_tz: f.chegada_tz,
    };
    const paxRows = pax
      .filter((p) => p.person_id)
      .map((p) => ({ id: p.id, person_id: p.person_id, nome_no_bilhete: p.nome_no_bilhete.trim() || null, assento: p.assento.trim() || null, eticket: p.eticket.trim() || null }));
    const ops: Op[] = montarOpsVoo({ tripId, id, valores: claude ? { ...valores, origem: "agente" } as typeof valores : valores, passageiros: paxRows, inicial });
    if (claude) ops.push(baixa(claude.inboxId, "confirmado", id, tripId));

    // Aparece na tela na hora.
    const novo: Ticket = {
      ...(inicial ?? ({ anexo_url: null, assento: null, nome_no_bilhete: null, criado_por: null } as unknown as Ticket)),
      id,
      trip_id: tripId,
      ...valores,
      passageiros: paxRows.map((p) => ({ ...p, ticket_id: id, loyalty_account_id: null }) as Passageiro),
    } as Ticket;
    naTela<Ticket>(qc, ticketsQuery(tripId).queryKey, (l) =>
      [...l.filter((x) => x.id !== id), novo].sort((a, b) => a.partida_utc.localeCompare(b.partida_utc)),
    );
    const item: ItemRoteiro = {
      item_tipo: "ticket",
      item_id: id,
      subtipo: valores.tipo,
      titulo: `${valores.origem_iata ?? valores.origem_cidade ?? "?"} → ${valores.destino_iata ?? valores.destino_cidade ?? "?"}`,
      inicio_utc: valores.partida_utc,
      inicio_tz: valores.partida_tz,
      fim_utc: valores.chegada_utc,
      fim_tz: valores.chegada_tz,
      cidade: valores.destino_cidade,
      origem_iata: valores.origem_iata,
      destino_iata: valores.destino_iata,
      companhia: valores.companhia,
      numero: valores.numero,
      pessoas: paxRows.map((p) => ({ id: p.person_id, nome: membros.find((m) => m.person_id === p.person_id)?.apelido || nomeDoc(p.person_id) })),
      detalhe: true,
      editar: true,
    };
    noRoteiro(qc, tripId, item);

    try {
      const r = await enviar(ops);
      await anexarImportado(tripId, "ticket", id).catch((e: Error) => toast.error(`Voo salvo, mas o anexo não subiu: ${e.message}`));
      toast.success(aviso(r, "Bilhete salvo"));
      avisarNovoAchado(antesAchados, achadosDoCache(qc, tripId), () => navigate({ to: "/trip/$id/revisao", params: { id: tripId } }));
      if (r === "salvo") void qc.invalidateQueries({ queryKey: ["roteiro", tripId] });
      if (claude) void qc.invalidateQueries({ queryKey: ["caixa-claude"] });
      navigate({ to: "/trip/$id/bilhetes", params: { id: tripId } });
    } catch (err) {
      toast.error((err as Error).message || "Não deu para salvar.");
      void qc.invalidateQueries({ queryKey: ["tickets", tripId] });
      void qc.invalidateQueries({ queryKey: ["roteiro", tripId] });
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4 px-4 pt-4">
      <Campo rotulo="Tipo">
        <select value={f.tipo} onChange={set("tipo")} className={inputCls}>
          <option value="voo">Voo</option>
          <option value="trem">Trem</option>
          <option value="onibus">Ônibus</option>
          <option value="carro">Carro</option>
          <option value="transfer">Transfer</option>
        </select>
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Companhia">
          <input value={f.companhia} onChange={set("companhia")} placeholder="TP" className={inputCls} />
        </Campo>
        <Campo rotulo="Número">
          <input value={f.numero} onChange={set("numero")} placeholder="88" className={inputCls} />
        </Campo>
      </div>
      <Campo rotulo="Localizador">
        <input value={f.localizador} onChange={set("localizador")} className={`${inputCls} mono-code`} />
      </Campo>

      {f.tipo === "voo" ? (
        <div className="grid grid-cols-2 gap-3">
          <CampoAeroporto
            rotulo="De"
            iata={f.origem_iata}
            onEscolher={(a) => setF((v) => ({ ...v, origem_iata: a.iata, origem_cidade: a.cidade ?? v.origem_cidade, partida_tz: a.tz ?? v.partida_tz }))}
          />
          <CampoAeroporto
            rotulo="Para"
            iata={f.destino_iata}
            onEscolher={(a) => setF((v) => ({ ...v, destino_iata: a.iata, destino_cidade: a.cidade ?? v.destino_cidade, chegada_tz: a.tz ?? v.chegada_tz }))}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Cidade saída">
            <input value={f.origem_cidade} onChange={set("origem_cidade")} className={inputCls} />
          </Campo>
          <Campo rotulo="Cidade chegada">
            <input value={f.destino_cidade} onChange={set("destino_cidade")} className={inputCls} />
          </Campo>
        </div>
      )}

      <div>
        <Campo rotulo="Partida (hora local)">
          <input type="datetime-local" required value={f.partida} onChange={set("partida")} className={inputCls} />
        </Campo>
        <TrocarFuso valor={f.partida_tz} onChange={(tz) => setF((v) => ({ ...v, partida_tz: tz }))} />
      </div>
      <div>
        <Campo rotulo="Chegada (hora local)">
          <input type="datetime-local" required value={f.chegada} onChange={set("chegada")} className={inputCls} />
        </Campo>
        <TrocarFuso valor={f.chegada_tz} onChange={(tz) => setF((v) => ({ ...v, chegada_tz: tz }))} />
      </div>

      <section className="space-y-3">
        <h2 className="text-xl">Passageiros</h2>
        {pax.map((p, i) => (
          <div key={p.id} className="space-y-3 rounded-2xl border-2 border-border bg-card p-4">
            <Campo rotulo={`Passageiro ${i + 1}`}>
              <select
                value={p.person_id}
                onChange={(e) => {
                  const pid = e.target.value;
                  setPax((l) => l.map((x) => (x.id === p.id ? { ...x, person_id: pid, nome_no_bilhete: x.nome_no_bilhete || nomeDoc(pid) } : x)));
                }}
                className={inputCls}
              >
                <option value="">Escolher…</option>
                {ativos.map((m) => (
                  <option key={m.person_id} value={m.person_id}>
                    {m.apelido || m.nome}
                    {m.kind === "dependent" ? " (dependente)" : ""}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Nome no bilhete">
              <input value={p.nome_no_bilhete} onChange={(e) => setPax((l) => l.map((x) => (x.id === p.id ? { ...x, nome_no_bilhete: e.target.value } : x)))} className={inputCls} />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Assento">
                <input value={p.assento} onChange={(e) => setPax((l) => l.map((x) => (x.id === p.id ? { ...x, assento: e.target.value } : x)))} className={inputCls} />
              </Campo>
              <Campo rotulo="E-ticket">
                <input value={p.eticket} onChange={(e) => setPax((l) => l.map((x) => (x.id === p.id ? { ...x, eticket: e.target.value } : x)))} className={`${inputCls} mono-code`} />
              </Campo>
            </div>
            <button type="button" onClick={() => setPax((l) => l.filter((x) => x.id !== p.id))} className="tap flex w-full items-center justify-center gap-2 rounded-xl border-2 border-border text-lg font-bold text-destructive">
              <Trash2 size={24} strokeWidth={2.2} /> Tirar passageiro
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setPax((l) => [...l, { id: novoId(), person_id: "", nome_no_bilhete: "", assento: "", eticket: "" }])}
          className="tap flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-accent text-lg font-bold text-accent"
        >
          <Plus size={26} strokeWidth={2.2} /> Adicionar passageiro
        </button>
      </section>

      <Campo rotulo="Liga ida e volta (código da reserva, opcional)">
        <input value={f.grupo_reserva} onChange={set("grupo_reserva")} className={`${inputCls} mono-code`} />
      </Campo>

      <button type="submit" disabled={salvando} className="gradient-hero shadow-medium tap flex w-full items-center justify-center gap-3 rounded-2xl text-xl font-bold">
        <Check size={28} strokeWidth={2.2} />
        {inicial ? "Salvar mudanças" : "Salvar bilhete"}
      </button>
    </form>
  );
}
