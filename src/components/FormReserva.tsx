import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { membersQuery, reservasQuery, type Reserva } from "@/lib/data";
import { fusoLocal, MOEDAS } from "@/lib/format";
import { localParaUtc, utcParaLocal } from "@/lib/fuso";
import { aviso, diffCampos, diffFilhos, enviar, naTela, noRoteiro, novoId } from "@/lib/itens";
import { Campo, inputCls } from "@/components/Form";
import { TrocarFuso } from "@/components/TrocarFuso";
import type { Op } from "@/lib/outbox";
import { anexarImportado } from "@/lib/importAnexo";

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
    moeda: inicial?.moeda ?? "BRL",
  }));
  const [pessoas, setPessoas] = useState<PessoaF[]>(() => (inicial?.pessoas ?? []).map((p) => ({ id: p.id, person_id: p.person_id, papel: p.papel ?? "" })));
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (inicial) return;
    const raw = sessionStorage.getItem(`evoque-import-${tripId}`); if (!raw) return;
    sessionStorage.removeItem(`evoque-import-${tripId}`);
    const x = JSON.parse(raw) as Record<string, string | number | null>;
    const tipo = ["carro", "passeio", "restaurante", "outro"].includes(String(x.tipo)) ? x.tipo as "carro" | "passeio" | "restaurante" | "outro" : "outro";
    setF((v) => ({ ...v, tipo, titulo: String(x.titulo ?? ""), inicio: String(x.inicio ?? ""), fim: String(x.fim ?? ""), local: String(x.local ?? ""), cidade: String(x.cidade ?? ""), localizador: String(x.localizador ?? ""), valor: x.valor == null ? "" : String(x.valor), moeda: String(x.moeda ?? "BRL") }));
  }, [inicial, tripId]);
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
    const id = inicial?.id ?? novoId();
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
    };
    const rows = pessoas.map((p) => ({ id: p.id, person_id: p.person_id, papel: p.papel.trim() || null }));
    const ops: Op[] = [];
    if (!inicial) ops.push({ tipo: "insert", tabela: "reservation", valores: { id, trip_id: tripId, ...valores } });
    else {
      const mud = diffCampos(inicial as unknown as Record<string, unknown>, valores);
      if (Object.keys(mud).length) ops.push({ tipo: "update", tabela: "reservation", id, valores: mud });
    }
    ops.push(...diffFilhos("reservation_person", (inicial?.pessoas ?? []) as unknown as ({ id: string } & Record<string, unknown>)[], rows, ["person_id", "papel"], { reservation_id: id }));

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
      await anexarImportado(tripId, "reservation", id);
      toast.success(aviso(r, "Reserva salva"));
      if (r === "salvo") void qc.invalidateQueries({ queryKey: ["roteiro", tripId] });
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
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Local">
          <input value={f.local} onChange={set("local")} className={inputCls} />
        </Campo>
        <Campo rotulo="Cidade">
          <input value={f.cidade} onChange={set("cidade")} className={inputCls} />
        </Campo>
      </div>
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
