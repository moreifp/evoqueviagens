import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { membersQuery, reservasQuery, tripQuery, type Reserva } from "@/lib/data";
import { fusoLocal } from "@/lib/format";
import { CampoMoeda } from "@/components/CampoMoeda";
import { moedaValida } from "@/lib/moedas";
import { localParaUtc, utcParaLocal } from "@/lib/fuso";
import { aviso, montarOpsReserva, enviar, naTela, noRoteiro, novoId } from "@/lib/itens";
import { Campo, inputCls } from "@/components/Form";
import { TrocarFuso } from "@/components/TrocarFuso";
import type { Op } from "@/lib/outbox";
import { baixa, lerEdicao } from "@/lib/caixaClaude";
import { PreencherArquivo, casarPessoa } from "@/components/PreencherArquivo";
import type { Leitura } from "@/lib/reserva-ai.functions";
import { anexarImportado, dataLocal } from "@/lib/importAnexo";
import { CampoLugar } from "@/components/CampoLugar";
import type { Lugar } from "@/lib/lugares.functions";

export const TIPOS_RESERVA = [
  { v: "carro", r: "Carro" },
  { v: "passeio", r: "Passeio" },
  { v: "restaurante", r: "Restaurante" },
  { v: "outro", r: "Outro" },
] as const;

type PessoaF = { id: string; person_id: string; papel: string };

export function FormReserva({ tripId, inicial }: { tripId: string; inicial?: Reserva }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: membros } = useSuspenseQuery(membersQuery(tripId));
  const { data: trip } = useSuspenseQuery(tripQuery(tripId));
  const moedaPadrao = trip.moeda_base || "BRL";
  const ativos = membros.filter((m) => m.status !== "recusado" && m.status !== "saiu");
  const [f, setF] = useState(() => ({
    tipo: inicial?.tipo ?? "carro",
    titulo: inicial?.titulo ?? "",
    inicio_tz: inicial?.inicio_tz ?? fusoLocal(),
    fim_tz: inicial?.fim_tz ?? inicial?.inicio_tz ?? fusoLocal(),
    inicio: inicial ? utcParaLocal(inicial.inicio_utc, inicial.inicio_tz) : "",
    fim: inicial?.fim_utc ? utcParaLocal(inicial.fim_utc, inicial.fim_tz ?? inicial.inicio_tz) : "",
    local: inicial?.local ?? "",
    cidade: inicial?.cidade ?? "",
    localizador: inicial?.localizador ?? "",
    valor: inicial?.valor != null ? String(inicial.valor) : "",
    moeda: inicial?.moeda ?? moedaPadrao,
  }));
  const [pessoas, setPessoas] = useState<PessoaF[]>(() => (inicial?.pessoas ?? []).map((p) => ({ id: p.id, person_id: p.person_id, papel: p.papel ?? "" })));
  const [salvando, setSalvando] = useState(false);
  const [geo, setGeo] = useState(() => ({ lat: inicial?.lat ?? null, lng: inicial?.lng ?? null, place_id: inicial?.place_id ?? null, site: inicial?.site ?? null }));
  function escolherLugar(l: Lugar) {
    setF((v) => ({
      ...v,
      titulo: v.titulo.trim() ? v.titulo : l.nome,
      local: l.nome && !l.endereco.startsWith(l.nome) ? `${l.nome} · ${l.endereco}` : l.endereco,
      cidade: l.cidade ?? v.cidade,
      ...(l.tz ? { inicio_tz: l.tz, fim_tz: l.tz } : {}),
    }));
    setGeo({ lat: l.lat, lng: l.lng, place_id: l.place_id, site: l.site });
  }
  const [claude, setClaude] = useState<{ inboxId: string; id: string } | null>(null);
  useEffect(() => {
    if (inicial) return;
    const ed = lerEdicao(tripId, "reserva");
    if (ed) {
      const p = ed.payload as unknown as { id: string; valores: Reserva; pessoas: PessoaF[] };
      const v = p.valores;
      setClaude({ inboxId: ed.inboxId, id: p.id });
      setF({ tipo: v.tipo as typeof f.tipo, titulo: v.titulo, inicio_tz: v.inicio_tz, fim_tz: v.fim_tz ?? v.inicio_tz, inicio: utcParaLocal(v.inicio_utc, v.inicio_tz), fim: v.fim_utc ? utcParaLocal(v.fim_utc, v.fim_tz ?? v.inicio_tz) : "", local: v.local ?? "", cidade: v.cidade ?? "", localizador: v.localizador ?? "", valor: v.valor != null ? String(v.valor) : "", moeda: v.moeda ?? moedaPadrao });
      setGeo({ lat: v.lat ?? null, lng: v.lng ?? null, place_id: v.place_id ?? null, site: v.site ?? null });
      setPessoas(p.pessoas.map((x) => ({ id: x.id, person_id: x.person_id, papel: x.papel ?? "" })));
      return;
    }
    const raw = sessionStorage.getItem(`evoque-import-${tripId}`); if (!raw) return;
    sessionStorage.removeItem(`evoque-import-${tripId}`);
    aplicar(JSON.parse(raw) as Leitura);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial, tripId]);
  function aplicar(x: Leitura) {
    const tipo = (["carro", "passeio", "restaurante", "outro"] as const).find((t) => t === x.tipo);
    setF((v) => ({ ...v, tipo: tipo ?? v.tipo, titulo: x.titulo ?? v.titulo, inicio: dataLocal(x.inicio) || v.inicio, fim: dataLocal(x.fim) || v.fim, local: x.local ?? v.local, cidade: x.cidade ?? v.cidade, localizador: x.localizador ?? v.localizador, valor: x.valor == null ? v.valor : String(x.valor), moeda: x.moeda ?? v.moeda }));
    const pids = [...new Set((x.pessoas ?? []).map((n) => casarPessoa(n, membros)).filter(Boolean) as string[])];
    if (pids.length) setPessoas(pids.map((pid) => ({ id: novoId(), person_id: pid, papel: "" })));
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((v) => ({ ...v, [k]: e.target.value }));
  const nome = (pid: string) => {
    const m = membros.find((x) => x.person_id === pid);
    return m ? m.apelido || m.nome : "?";
  };

  function alternar(pid: string) {
    setPessoas((l) => (l.some((p) => p.person_id === pid) ? l.filter((p) => p.person_id !== pid) : [...l, { id: novoId(), person_id: pid, papel: "" }]));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.titulo.trim() || !f.inicio) return toast.error("Preencha o nome e o início.");
    setSalvando(true);
    const id = inicial?.id ?? claude?.id ?? novoId();
    const valores = {
      tipo: f.tipo,
      titulo: f.titulo.trim(),
      inicio_utc: localParaUtc(f.inicio, f.inicio_tz),
      inicio_tz: f.inicio_tz,
      fim_utc: f.fim ? localParaUtc(f.fim, f.fim_tz) : null,
      fim_tz: f.fim ? f.fim_tz : null,
      local: f.local.trim() || null,
      cidade: f.cidade.trim() || null,
      localizador: f.localizador.trim() || null,
      valor: f.valor ? Number(f.valor.replace(",", ".")) : null,
      moeda: f.valor ? f.moeda : null,
      ...geo,
    };
    const rows = pessoas.map((p) => ({ id: p.id, person_id: p.person_id, papel: p.papel.trim() || null }));
    const ops: Op[] = montarOpsReserva({ tripId, id, valores: claude ? ({ ...valores, origem: "agente" } as typeof valores) : valores, pessoas: rows, inicial });
    if (claude) ops.push(baixa(claude.inboxId, "confirmado", id, tripId));

    const novo = { ...(inicial ?? { criado_por: null }), id, trip_id: tripId, ...valores, pessoas: rows.map((r) => ({ ...r, reservation_id: id })) } as Reserva;
    naTela<Reserva>(qc, reservasQuery(tripId).queryKey, (l) => [...l.filter((x) => x.id !== id), novo].sort((a, b) => a.inicio_utc.localeCompare(b.inicio_utc)));
    noRoteiro(qc, tripId, {
      item_tipo: "reservation",
      item_id: id,
      subtipo: valores.tipo,
      titulo: valores.titulo,
      inicio_utc: valores.inicio_utc,
      inicio_tz: valores.inicio_tz,
      fim_utc: valores.fim_utc,
      fim_tz: valores.fim_tz,
      cidade: valores.cidade,
      origem_iata: null,
      destino_iata: null,
      companhia: null,
      numero: null,
      pessoas: rows.map((r) => ({ id: r.person_id, nome: nome(r.person_id), papel: r.papel })),
      detalhe: true,
      editar: true,
    });
    try {
      const r = await enviar(ops);
      await anexarImportado(tripId, "reservation", id).catch((e: Error) => toast.error(`Reserva salva, mas o anexo não subiu: ${e.message}`));
      toast.success(aviso(r, "Reserva salva"));
      if (r === "salvo") void qc.invalidateQueries({ queryKey: ["roteiro", tripId] });
      if (claude) void qc.invalidateQueries({ queryKey: ["caixa-claude"] });
      navigate({ to: "/trip/$id/reservas", params: { id: tripId } });
    } catch (err) {
      toast.error((err as Error).message || "Não deu para salvar.");
      void qc.invalidateQueries({ queryKey: ["reservas", tripId] });
      void qc.invalidateQueries({ queryKey: ["roteiro", tripId] });
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4 px-4 pt-4">
      {!inicial && <PreencherArquivo tripId={tripId} esperado="reserva" onLido={aplicar} />}
      <Campo rotulo="Tipo">
        <select value={f.tipo} onChange={set("tipo")} className={inputCls}>
          {TIPOS_RESERVA.map((t) => (
            <option key={t.v} value={t.v}>
              {t.r}
            </option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="Nome">
        <input required value={f.titulo} onChange={set("titulo")} placeholder="Localiza · retirada no aeroporto" className={inputCls} />
      </Campo>
      <div>
        <Campo rotulo="Início (hora local)">
          <input type="datetime-local" required value={f.inicio} onChange={set("inicio")} className={inputCls} />
        </Campo>
        <TrocarFuso valor={f.inicio_tz} onChange={(tz) => setF((v) => ({ ...v, inicio_tz: tz, fim_tz: tz }))} />
      </div>
      <Campo rotulo="Fim (opcional)">
        <input type="datetime-local" value={f.fim} onChange={set("fim")} className={inputCls} />
      </Campo>
      <Campo rotulo={f.tipo === "restaurante" ? "Restaurante / local" : "Local"}>
        <CampoLugar
          valor={f.local}
          onTexto={(v) => {
            setF((x) => ({ ...x, local: v }));
            setGeo((g) => ({ ...g, lat: null, lng: null, place_id: null }));
          }}
          onEscolher={escolherLugar}
          perto={f.cidade}
          placeholder="Digite o nome ou endereço para buscar"
        />
      </Campo>
      {geo.lat != null && <p className="text-base text-muted-foreground">Local do mapa · horário local {f.inicio_tz}</p>}
      <Campo rotulo="Cidade">
        <input value={f.cidade} onChange={set("cidade")} className={inputCls} />
      </Campo>
      <Campo rotulo="Localizador">
        <input value={f.localizador} onChange={set("localizador")} className={`${inputCls} mono-code`} />
      </Campo>
      <Campo rotulo="Valor">
          <input inputMode="decimal" value={f.valor} onChange={set("valor")} className={inputCls} />
        </Campo>
      <CampoMoeda value={f.moeda} onChange={(m) => setF((v) => ({ ...v, moeda: m }))} />

      <section className="space-y-3">
        <h2 className="text-xl">Quem vai</h2>
        {ativos.map((m) => {
          const p = pessoas.find((x) => x.person_id === m.person_id);
          return (
            <div key={m.person_id} className="rounded-2xl border-2 border-border bg-card p-3">
              <label className="flex min-h-[56px] items-center gap-3 text-lg font-bold">
                <input type="checkbox" checked={!!p} onChange={() => alternar(m.person_id)} className="h-7 w-7 accent-[var(--accent)]" />
                {m.apelido || m.nome}
              </label>
              {p && f.tipo === "carro" && (
                <input
                  value={p.papel}
                  placeholder="Papel (ex.: motorista)"
                  onChange={(e) => setPessoas((l) => l.map((x) => (x.id === p.id ? { ...x, papel: e.target.value } : x)))}
                  className={`${inputCls} mt-2`}
                />
              )}
            </div>
          );
        })}
      </section>

      <button type="submit" disabled={salvando} className="gradient-hero shadow-medium tap flex w-full items-center justify-center gap-3 rounded-2xl text-xl font-bold">
        <Check size={28} strokeWidth={2.2} />
        {inicial ? "Salvar mudanças" : "Salvar reserva"}
      </button>
    </form>
  );
}
