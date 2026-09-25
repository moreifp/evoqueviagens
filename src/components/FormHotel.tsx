import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Plus, Trash2, X } from "lucide-react";
import { lodgingsQuery, membersQuery, type Lodging, type Quarto } from "@/lib/data";
import { fusoLocal, MOEDAS } from "@/lib/format";
import { localParaUtc, utcParaLocal } from "@/lib/fuso";
import { aviso, montarOpsHotel, enviar, naTela, noRoteiro, novoId } from "@/lib/itens";
import { achadosDoCache, avisarNovoAchado } from "@/lib/auditoria";
import { Campo, inputCls } from "@/components/Form";
import type { Op } from "@/lib/outbox";
import { baixa, lerEdicao } from "@/lib/caixaClaude";
import { anexarImportado, dataLocal, soData } from "@/lib/importAnexo";
import { CampoLugar } from "@/components/CampoLugar";
import { PreencherArquivo, casarPessoa } from "@/components/PreencherArquivo";
import type { Leitura } from "@/lib/reserva-ai.functions";
import type { Lugar } from "@/lib/lugares.functions";

type QuartoF = { id: string; nome: string; tipo: string; hospedes: { id: string; person_id: string }[] };

export function FormHotel({ tripId, inicial }: { tripId: string; inicial?: Lodging }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: membros } = useSuspenseQuery(membersQuery(tripId));
  const ativos = membros.filter((m) => m.status !== "recusado" && m.status !== "saiu");
  const tzIni = inicial?.tz ?? fusoLocal();
  const [f, setF] = useState(() => ({
    nome: inicial?.nome ?? "",
    endereco: inicial?.endereco ?? "",
    cidade: inicial?.cidade ?? "",
    checkin: inicial ? utcParaLocal(inicial.checkin, tzIni) : "",
    checkout: inicial ? utcParaLocal(inicial.checkout, tzIni) : "",
    localizador: inicial?.localizador ?? "",
    valor: inicial?.valor != null ? String(inicial.valor) : "",
    moeda: inicial?.moeda ?? "BRL",
    politica_cancelamento: inicial?.politica_cancelamento ?? "",
    cancelamento_gratis_ate: inicial?.cancelamento_gratis_ate ?? "",
  }));
  const [geo, setGeo] = useState(() => ({ lat: inicial?.lat ?? null, lng: inicial?.lng ?? null, place_id: inicial?.place_id ?? null, site: inicial?.site ?? null, tz: tzIni }));
  const tz = geo.tz;
  const escolherLugar = (l: Lugar, manterNome: boolean) => {
    setF((v) => ({ ...v, nome: manterNome && v.nome.trim() ? v.nome : l.nome, endereco: l.endereco, cidade: l.cidade ?? v.cidade }));
    setGeo({ lat: l.lat, lng: l.lng, place_id: l.place_id, site: l.site, tz: l.tz ?? geo.tz });
  };
  const textoMudou = (k: "nome" | "endereco") => (v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    if (k === "endereco") setGeo((g) => ({ ...g, lat: null, lng: null, place_id: null }));
  };
  const [quartos, setQuartos] = useState<QuartoF[]>(() =>
    (inicial?.quartos ?? []).map((q) => ({ id: q.id, nome: q.nome, tipo: q.tipo ?? "", hospedes: q.hospedes.map((g) => ({ id: g.id, person_id: g.person_id })) })),
  );
  const [salvando, setSalvando] = useState(false);
  const [claude, setClaude] = useState<{ inboxId: string; id: string } | null>(null);
  useEffect(() => {
    if (inicial) return;
    const ed = lerEdicao(tripId, "hotel");
    if (ed) {
      const p = ed.payload as unknown as { id: string; valores: Lodging & { tz: string }; quartos: QuartoF[] };
      const v = p.valores;
      setClaude({ inboxId: ed.inboxId, id: p.id });
      setF({ nome: v.nome, endereco: v.endereco ?? "", cidade: v.cidade ?? "", checkin: utcParaLocal(v.checkin, v.tz), checkout: utcParaLocal(v.checkout, v.tz), localizador: v.localizador ?? "", valor: v.valor != null ? String(v.valor) : "", moeda: v.moeda ?? "BRL", politica_cancelamento: v.politica_cancelamento ?? "", cancelamento_gratis_ate: v.cancelamento_gratis_ate ?? "" });
      setGeo({ lat: v.lat ?? null, lng: v.lng ?? null, place_id: v.place_id ?? null, site: v.site ?? null, tz: v.tz });
      setQuartos(p.quartos.map((q) => ({ id: q.id, nome: q.nome, tipo: q.tipo ?? "", hospedes: q.hospedes })));
      return;
    }
    const raw = sessionStorage.getItem(`evoque-import-${tripId}`); if (!raw) return;
    sessionStorage.removeItem(`evoque-import-${tripId}`);
    aplicar(JSON.parse(raw) as Leitura);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial, tripId]);
  function aplicar(x: Leitura) {
    setF((v) => ({ ...v, nome: x.titulo ?? v.nome, cidade: x.cidade ?? v.cidade, endereco: x.local ?? v.endereco, localizador: x.localizador ?? v.localizador, checkin: dataLocal(x.inicio) || v.checkin, checkout: dataLocal(x.fim) || v.checkout, valor: x.valor == null ? v.valor : String(x.valor), moeda: x.moeda && (MOEDAS as readonly string[]).includes(x.moeda) ? x.moeda : v.moeda, cancelamento_gratis_ate: soData(x.cancelamento_gratis_ate) || v.cancelamento_gratis_ate, politica_cancelamento: x.politica_cancelamento ?? v.politica_cancelamento }));
    const qs = (x.quartos ?? []).length ? x.quartos : (x.pessoas ?? []).length ? [{ nome: "Quarto 1", tipo: null, hospedes: x.pessoas }] : [];
    if (qs.length) setQuartos(qs.map((q) => ({ id: novoId(), nome: q.nome, tipo: q.tipo ?? "", hospedes: [...new Set(q.hospedes.map((n) => casarPessoa(n, ativos)).filter(Boolean) as string[])].map((pid) => ({ id: novoId(), person_id: pid })) })));
  }
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
    const id = inicial?.id ?? claude?.id ?? novoId();
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
      lat: geo.lat,
      lng: geo.lng,
      place_id: geo.place_id,
      site: geo.site,
      tz: geo.tz,
    };
    const ops: Op[] = montarOpsHotel({
      tripId,
      id,
      valores: claude ? ({ ...valores, origem: "agente" } as typeof valores) : valores,
      quartos: quartos.map((q) => ({ id: q.id, nome: q.nome.trim() || "Quarto", tipo: q.tipo.trim() || null, hospedes: q.hospedes })),
      inicial,
    });
    if (claude) ops.push(baixa(claude.inboxId, "confirmado", id, tripId));

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
      if (claude) void qc.invalidateQueries({ queryKey: ["caixa-claude"] });
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
      {!inicial && <PreencherArquivo tripId={tripId} esperado="hotel" onLido={aplicar} />}
      <Campo rotulo="Nome do hotel">
        <CampoLugar valor={f.nome} onTexto={textoMudou("nome")} onEscolher={(l) => escolherLugar(l, false)} perto={f.cidade} placeholder="Digite o nome para buscar" />
      </Campo>
      <Campo rotulo="Cidade">
        <input value={f.cidade} onChange={set("cidade")} className={inputCls} />
      </Campo>
      <Campo rotulo="Endereço">
        <CampoLugar valor={f.endereco} onTexto={textoMudou("endereco")} onEscolher={(l) => escolherLugar(l, true)} perto={f.cidade} placeholder="Rua, número" />
      </Campo>
      {geo.lat != null && <p className="text-base text-muted-foreground">Endereço do mapa · horário local {geo.tz}</p>}
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
