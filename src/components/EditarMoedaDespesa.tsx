import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CampoMoeda } from "./CampoMoeda";
import { Campo, inputCls } from "./Form";
import { buscarCotacaoDetalhe } from "@/lib/data";
import { mutar } from "@/lib/outbox";
import { dataBRCurta } from "@/lib/format";

type Desp = { id: string; valor_original: number | string; moeda_original: string; taxa_cambio: number | string; taxa_fonte?: string | null; taxa_data?: string | null };

/** Trocar a moeda de um gasto: grava uma nova cotação (a antiga não é alterada, é substituída por um novo snapshot). */
export function EditarMoedaDespesa({ d, moedaBase, queryKey }: { d: Desp; moedaBase: string; queryKey: readonly unknown[] }) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [moeda, setMoeda] = useState(d.moeda_original);
  const [valor, setValor] = useState(String(d.valor_original));
  const [taxa, setTaxa] = useState(String(d.taxa_cambio));
  const [fonte, setFonte] = useState<{ fonte: string; data: string; taxa: number } | null>(null);
  const [msg, setMsg] = useState("");

  async function trocar(c: string) {
    setMoeda(c); setFonte(null); setMsg("Buscando cotação…");
    const r = await buscarCotacaoDetalhe(c, moedaBase);
    if (r) { setTaxa(String(r.taxa)); setFonte(r); setMsg(""); } else { setTaxa(""); setMsg("Sem cotação automática para esta moeda. Digite a taxa."); }
  }
  async function salvar() {
    const t = Number(taxa.replace(",", ".")); const v = Number(valor.replace(",", "."));
    if (!(t > 0) || !(v > 0)) return toast.error("Informe valor e taxa.");
    const auto = fonte && fonte.taxa === t;
    await mutar({ tipo: "update", tabela: "expense", id: d.id, valores: { moeda_original: moeda, valor_original: v, taxa_cambio: t, valor_moeda_base: Math.round(v * t * 100) / 100, taxa_fonte: moeda === moedaBase ? null : auto ? fonte.fonte : "manual", taxa_data: moeda === moedaBase ? null : auto ? fonte.data : new Date().toISOString().slice(0, 10), editado_em: new Date().toISOString() } });
    await qc.invalidateQueries({ queryKey }); setAberto(false); toast.success("Gasto atualizado");
  }
  if (!aberto) return <button type="button" onClick={() => setAberto(true)} className="tap w-full border-t border-border text-lg font-bold text-accent">Trocar moeda ou cotação</button>;
  return (
    <div className="space-y-3 border-t border-border p-3">
      <CampoMoeda value={moeda} onChange={(c) => void trocar(c)} rotulo="Moeda do gasto" />
      <Campo rotulo={`Valor (${moeda})`}><input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className={inputCls} /></Campo>
      {moeda !== moedaBase && <Campo rotulo={`1 ${moeda} = ? ${moedaBase}`}><input inputMode="decimal" value={taxa} onChange={(e) => { setTaxa(e.target.value); }} className={inputCls} /></Campo>}
      {fonte && <p className="text-base font-semibold text-muted-foreground">{fonte.fonte} · {dataBRCurta(fonte.data)}</p>}
      {msg && <p role="status" className="text-base font-semibold">{msg}</p>}
      <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => void salvar()} className="gradient-hero tap rounded-xl text-lg font-bold">Salvar</button><button type="button" onClick={() => setAberto(false)} className="tap rounded-xl border-2 border-border text-lg font-bold">Cancelar</button></div>
    </div>
  );
}
