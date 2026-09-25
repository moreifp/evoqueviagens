import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Plus, Trash2, X } from "lucide-react";
import { lodgingsQuery, membersQuery, type Lodging, type Quarto } from "@/lib/data";
import { fusoLocal, MOEDAS } from "@/lib/format";
import { localParaUtc, utcParaLocal } from "@/lib/fuso";
import { aviso, diffCampos, diffFilhos, enviar, naTela, noRoteiro, novoId } from "@/lib/itens";
import { achadosDoCache, avisarNovoAchado } from "@/lib/auditoria";
import { Campo, inputCls } from "@/components/Form";
import type { Op } from "@/lib/outbox";
import { anexarImportado, dataLocal, soData } from "@/lib/importAnexo";

type QuartoF = { id: string; nome: string; tipo: string; hospedes: { id: string; person_id: string }[] };

export function FormHotel({ tripId, inicial }: { tripId: string; inicial?: Lodging }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: membros } = useSuspenseQuery(membersQuery(tripId));
  const ativos = membros.filter((m) => m.status !== "recusado" && m.status !== "saiu");
  const tz = fusoLocal();
  const [f, setF] = useState(() => ({
    nome: inicial?.nome ?? "",
    endereco: inicial?.endereco ?? "",
    cidade: inicial?.cidade ?? "",
    checkin: inicial ? utcParaLocal(inicial.checkin, tz) : "",
    checkout: inicial ? utcParaLocal(inicial.checkout, tz) : "",
    localizador: inicial?.localizador ?? "",
    valor: inicial?.valor != null ? String(inicial.valor) : "",
    moeda: inicial?.moeda ?? "BRL",
    politica_cancelamento: inicial?.politica_cancelamento ?? "",
    cancelamento_gratis_ate: inicial?.cancelamento_gratis_ate ?? "",
  }));
  const [quartos, setQuartos] = useState<QuartoF[]>(() =>
    (inicial?.quartos ?? []).map((q) => ({ id: q.id, nome: q.nome, tipo: q.tipo ?? "", hospedes: q.hospedes.map((g) => ({ id: g.id, person_id: g.person_id })) })),
  );
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (inicial) return;
    const raw = sessionStorage.getItem(`evoque-import-${tripId}`); if (!raw) return;
    sessionStorage.removeItem(`evoque-import-${tripId}`);
    const x = JSON.parse(raw) as Record<string, string | number | null>;
    setF((v) => ({ ...v, nome: String(x.titulo ?? ""), cidade: String(x.cidade ?? ""), endereco: String(x.local ?? ""), localizador: String(x.localizador ?? ""), checkin: dataLocal(x.inicio as string | null), checkout: dataLocal(x.fim as string | null), valor: x.valor == null ? "" : String(x.valor), moeda: String(x.moeda ?? "BRL"), cancelamento_gratis_ate: soData(x.cancelamento_gratis_ate as string | null) }));
  }, [inicial, tripId]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((v) => ({ ...v, [k]: e.target.value }));
  const nome = (pid: string) => {
    const m = membros.find((x) => x.person_id === pid);
    return m ? m.apelido || m.nome : "?";
  };

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nome.trim() || !f.checkin || !f.checkout) return toast.error("Preencha nome, entrada e saída.");
    if (f.checkout <= f.checkin) return toast.error("A saída precisa ser depois da entrada.");
    setSalvando(true);
    const antesAchados = achadosDoCache(qc, tripId);
    const id = inicial?.id ?? novoId();
    const valores = {
      nome: f.nome.trim(),
      endereco: f.endereco.trim() || null,
      cidade: f.cidade.trim() || null,
      checkin: localParaUtc(f.checkin, tz),
      checkout: localParaUtc(f.checkout, tz),
      localizador: f.localizador.trim() || null,
      valor: f.valor ? Number(f.valor.replace(",", ".")) : null,
      moeda: f.valor ? f.moeda : null,
      politica_cancelamento: f.politica_cancelamento.trim() || null,
      cancelamento_gratis_ate: f.cancelamento_gratis_ate || null,
    };
    const ops: Op[] = [];
    if (!inicial) ops.push({ tipo: "insert", tabela: "lodging", valores: { id, trip_id: tripId, ...valores } });
    else {
      const mud = diffCampos(inicial as unknown as Record<string, unknown>, valores);
      if (Object.keys(mud).length) ops.push({ tipo: "update", tabela: "lodging", id, valores: mud });
    }
    const antesQ = inicial?.quartos ?? [];
    ops.push(
      ...diffFilhos(
        "lodging_room",
        antesQ as unknown as ({ id: string } & Record<string, unknown>)[],
        quartos.map((q) => ({ id: q.id, nome: q.nome.trim() || "Quarto", tipo: q.tipo.trim() || null })),
        ["nome", "tipo"],
        { lodging_id: id },
      ),
    );
    for (const q of quartos) {
      const anteriores = antesQ.find((x) => x.id === q.id)?.hospedes ?? [];
      ops.push(
        ...diffFilhos(
          "lodging_guest",
          anteriores as unknown as ({ id: string } & Record<string, unknown>)[],
          q.hospedes.filter((g) => g.person_id),
          ["person_id"],
          { room_id: q.id },
        ),
      );
    }

    const novosQuartos: Quarto[] = quartos.map((q) => ({
      id: q.id,
      lodging_id: id,
      nome: q.nome.trim() || "Quarto",
      tipo: q.tipo.trim() || null,
      hospedes: q.hospedes.filter((g) => g.person_id).map((g) => ({ id: g.id, room_id: q.id, person_id: g.person_id })),
    }));
    const novo = { ...(inicial ?? { anexo_url: null, criado_por: null }), id, trip_id: tripId, ...valores, quartos: novosQuartos } as Lodging;
    naTela<Lodging>(qc, lodgingsQuery(tripId).queryKey, (l) => [...l.filter((x) => x.id !== id), novo].sort((a, b) => a.checkin.localeCompare(b.checkin)));
    const pessoas = [...new Set(novosQuartos.flatMap((q) => q.hospedes.map((g) => g.person_id)))];
    noRoteiro(qc, tripId, {
      item_tipo: "lodging",
      item_id: id,
      subtipo: "hotel",
      titulo: valores.nome,
      inicio_utc: valores.checkin,
      inicio_tz: "UTC",
      fim_utc: valores.checkout,
      fim_tz: "UTC",
      cidade: valores.cidade,
      origem_iata: null,
      destino_iata: null,
      companhia: null,
      numero: null,
      pessoas: pessoas.map((pid) => ({ id: pid, nome: nome(pid) })),
      detalhe: true,
      editar: true,
    });

    try {
      const r = await enviar(ops);
      await anexarImportado(tripId, "lodging", id).catch((e: Error) => toast.error(`Hotel salvo, mas o anexo não subiu: ${e.message}`));
      toast.success(aviso(r, "Hospedagem salva"));
      avisarNovoAchado(antesAchados, achadosDoCache(qc, tripId), () => navigate({ to: "/trip/$id/revisao", params: { id: tripId } }));
      if (r === "salvo") void qc.invalidateQueries({ queryKey: ["roteiro", tripId] });
      navigate({ to: "/trip/$id/hospedagem", params: { id: tripId } });
    } catch (err) {
      toast.error((err as Error).message || "Não deu para salvar.");
      void qc.invalidateQueries({ queryKey: ["lodgings", tripId] });
      void qc.invalidateQueries({ queryKey: ["roteiro", tripId] });
      setSalvando(false);
    }
  }

  const naoAlocados = ativos.filter((m) => !quartos.some((q) => q.hospedes.some((g) => g.person_id === m.person_id)));

  return (
    <form onSubmit={salvar} className="space-y-4 px-4 pt-4">
      <Campo rotulo="Nome do hotel">
        <input required value={f.nome} onChange={set("nome")} className={inputCls} />
      </Campo>
      <Campo rotulo="Cidade">
        <input value={f.cidade} onChange={set("cidade")} className={inputCls} />
      </Campo>
      <Campo rotulo="Endereço">
        <input value={f.endereco} onChange={set("endereco")} className={inputCls} />
      </Campo>
      <Campo rotulo="Entrada">
        <input type="datetime-local" required value={f.checkin} onChange={set("checkin")} className={inputCls} />
      </Campo>
      <Campo rotulo="Saída">
        <input type="datetime-local" required value={f.checkout} onChange={set("checkout")} className={inputCls} />
      </Campo>
      <Campo rotulo="Localizador">
        <input value={f.localizador} onChange={set("localizador")} className={`${inputCls} mono-code`} />
      </Campo>
      <div className="grid grid-cols-[1fr_120px] gap-3">
        <Campo rotulo="Valor">
          <input inputMode="decimal" value={f.valor} onChange={set("valor")} className={inputCls} />
        </Campo>
        <Campo rotulo="Moeda">
          <select value={f.moeda} onChange={set("moeda")} className={inputCls}>
            {MOEDAS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo rotulo="Cancelamento">
        <textarea value={f.politica_cancelamento} onChange={set("politica_cancelamento")} rows={2} className={`${inputCls} py-3`} />
      </Campo>
      <Campo rotulo="Cancelamento grátis até">
        <input type="date" value={f.cancelamento_gratis_ate} onChange={set("cancelamento_gratis_ate")} className={inputCls} />
      </Campo>

      <section className="space-y-3">
        <h2 className="text-xl">Quartos</h2>
        {quartos.map((q) => (
          <div key={q.id} className="space-y-3 rounded-2xl border-2 border-border bg-card p-4">
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Quarto">
                <input value={q.nome} onChange={(e) => setQuartos((l) => l.map((x) => (x.id === q.id ? { ...x, nome: e.target.value } : x)))} className={inputCls} />
              </Campo>
              <Campo rotulo="Tipo">
                <input value={q.tipo} placeholder="Casal, 2 camas…" onChange={(e) => setQuartos((l) => l.map((x) => (x.id === q.id ? { ...x, tipo: e.target.value } : x)))} className={inputCls} />
              </Campo>
            </div>
            <p className="text-base font-bold">Hóspedes</p>
            <div className="flex flex-wrap gap-2">
              {q.hospedes.map((g) => (
                <button
                  type="button"
                  key={g.id}
                  onClick={() => setQuartos((l) => l.map((x) => (x.id === q.id ? { ...x, hospedes: x.hospedes.filter((y) => y.id !== g.id) } : x)))}
                  className="flex min-h-[56px] items-center gap-2 rounded-full bg-muted px-4 text-lg font-bold"
                  aria-label={`Tirar ${nome(g.person_id)} do quarto`}
                >
                  {nome(g.person_id)} <X size={20} strokeWidth={2.2} />
                </button>
              ))}
            </div>
            {naoAlocados.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  const pid = e.target.value;
                  if (pid) setQuartos((l) => l.map((x) => (x.id === q.id ? { ...x, hospedes: [...x.hospedes, { id: novoId(), person_id: pid }] } : x)));
                }}
                className={inputCls}
              >
                <option value="">+ Pôr pessoa neste quarto</option>
                {naoAlocados.map((m) => (
                  <option key={m.person_id} value={m.person_id}>
                    {m.apelido || m.nome}
                  </option>
                ))}
              </select>
            )}
            <button type="button" onClick={() => setQuartos((l) => l.filter((x) => x.id !== q.id))} className="tap flex w-full items-center justify-center gap-2 rounded-xl border-2 border-border text-lg font-bold text-destructive">
              <Trash2 size={24} strokeWidth={2.2} /> Tirar quarto
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setQuartos((l) => [...l, { id: novoId(), nome: `Quarto ${l.length + 1}`, tipo: "", hospedes: [] }])}
          className="tap flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-accent text-lg font-bold text-accent"
        >
          <Plus size={26} strokeWidth={2.2} /> Adicionar quarto
        </button>
      </section>

      <button type="submit" disabled={salvando} className="gradient-hero shadow-medium tap flex w-full items-center justify-center gap-3 rounded-2xl text-xl font-bold">
        <Check size={28} strokeWidth={2.2} />
        {inicial ? "Salvar mudanças" : "Salvar hospedagem"}
      </button>
    </form>
  );
}
