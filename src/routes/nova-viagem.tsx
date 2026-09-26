import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Topo } from "@/components/Chrome";
import { tripQuery, tripsQuery, type Trip } from "@/lib/data";
import { CampoMoeda } from "@/components/CampoMoeda";
import { supabase } from "@/integrations/supabase/client";
import { Campo, inputCls } from "@/components/Form";
import { CampoCidades } from "@/components/CampoCidades";
import { enviar, naTela, novoId } from "@/lib/itens";
import type { Op } from "@/lib/outbox";

export const Route = createFileRoute("/nova-viagem")({
  head: () => ({
    meta: [
      { title: "Nova viagem — Evoque Viagens" },
      { name: "description", content: "Cadastre uma viagem com datas e moeda de referência." },
      { property: "og:title", content: "Nova viagem" },
      { property: "og:description", content: "Cadastre uma viagem com datas e moeda de referência." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { duplicar?: string; editar?: string } => ({ ...(typeof s.duplicar === "string" ? { duplicar: s.duplicar } : {}), ...(typeof s.editar === "string" ? { editar: s.editar } : {}) }),
  component: NovaViagem,
});


function NovaViagem() {
  const navigate = useNavigate();
  const { duplicar, editar } = Route.useSearch();
  const qc = useQueryClient();
  const { data: origem } = useQuery({ ...tripQuery(duplicar ?? ""), enabled: Boolean(duplicar) });
  const { data: atual } = useQuery({ ...tripQuery(editar ?? ""), enabled: Boolean(editar) });
  const [nome, setNome] = useState(() => duplicar ? "Cópia da viagem" : "");
  const [cidades, setCidades] = useState<string[]>([]);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [moeda, setMoeda] = useState("BRL");
  const [salvando, setSalvando] = useState(false);

  function isoDia(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function somarDias(iso: string, dias: number) {
    const [a = 0, m = 1, d = 1] = iso.split("-").map(Number);
    return isoDia(new Date(a, m - 1, d + dias));
  }
  const hoje = isoDia(new Date());
  const minInicio = editar ? undefined : hoje;
  const minFim = inicio ? somarDias(inicio, 1) : minInicio;

  function mudarInicio(valor: string) {
    setInicio(valor);
    if (valor && (!fim || fim <= valor)) setFim(somarDias(valor, 1));
  }
  useEffect(() => {
    if (!origem) return;
    setNome(`Cópia de ${origem.nome}`);
    setCidades(origem.cidades?.length ? origem.cidades : origem.destino ? origem.destino.split(",").map((x) => x.trim()).filter(Boolean) : []);
    setMoeda(origem.moeda_base);
  }, [origem]);
  useEffect(() => {
    if (!atual) return;
    setNome(atual.nome); setInicio(atual.data_inicio); setFim(atual.data_fim); setMoeda(atual.moeda_base);
    setCidades(atual.cidades?.length ? atual.cidades : atual.destino ? atual.destino.split(",").map((x) => x.trim()).filter(Boolean) : []);
  }, [atual]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (inicio && fim && fim <= inicio) {
      toast.error("O fim precisa ser depois do início");
      return;
    }
    setSalvando(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const tripId = novoId();
      const destino = cidades.join(", ");
      if (atual) {
        const valores = { nome, cidades, destino: destino || null, data_inicio: inicio, data_fim: fim, moeda_base: moeda };
        const r = await enviar([{ tipo: "update", tabela: "trip", id: atual.id, valores }]);
        naTela<Trip>(qc, tripsQuery().queryKey, (l) => l.map((t) => (t.id === atual.id ? { ...t, ...valores } : t)));
        qc.setQueryData(tripQuery(atual.id).queryKey, { ...atual, ...valores });
        toast.success(r === "fila" ? "Sem internet · alteração salva no aparelho" : "Viagem atualizada");
        navigate({ to: "/trip/$id", params: { id: atual.id } });
        return;
      }
      // Duplicar é uma operação única no servidor: viagem, participantes e reservas entram juntos ou nada entra.
      const ops: Op[] = origem
        ? [{ tipo: "rpc", funcao: "duplicar_viagem", args: { _origem: origem.id, _novo: tripId, _nome: nome, _cidades: cidades, _inicio: inicio, _fim: fim, _moeda: moeda } }]
        : [{ tipo: "insert", tabela: "trip", valores: { id: tripId, owner_id: auth.user?.id, nome, destino: destino || null, cidades, data_inicio: inicio, data_fim: fim, moeda_base: moeda, status: "planejada" } }];
      const resultado = await enviar(ops);
      const nova = { id: tripId, owner_id: auth.user?.id ?? "", nome, destino: destino || null, cidades, data_inicio: inicio, data_fim: fim, moeda_base: moeda, status: "planejada", capa_url: null, arquivada_em: null, created_at: new Date().toISOString(), deleted_at: null } satisfies Trip;
      naTela<Trip>(qc, tripsQuery().queryKey, (l) => [...l, nova].sort((a,b) => a.data_inicio.localeCompare(b.data_inicio)));
      toast.success(resultado === "fila" ? "Sem internet · viagem salva no aparelho" : origem ? "Viagem duplicada" : "Viagem criada");
      navigate({ to: "/trip/$id", params: { id: tripId } });
    } catch (err) {
      toast.error((err as Error).message);
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <Topo titulo={editar ? "Editar viagem" : "Nova viagem"} voltarPara="/viagens" />
      <form onSubmit={salvar} className="space-y-5 px-4 pt-4">
        <Campo rotulo="Nome">
          <input required value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} />
        </Campo>
        <div role="group" aria-labelledby="rotulo-cidades">
          <span id="rotulo-cidades" className="text-base font-bold text-foreground">Cidades</span>
          <div className="mt-2"><CampoCidades cidades={cidades} onChange={setCidades} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Início">
            <input type="date" required value={inicio} min={minInicio} max="2099-12-31" onChange={(e) => mudarInicio(e.target.value)} className={inputCls} />
          </Campo>
          <Campo rotulo="Fim">
            <input type="date" required value={fim} min={minFim} max="2099-12-31" onChange={(e) => setFim(e.target.value)} className={inputCls} />
          </Campo>
        </div>
        <CampoMoeda rotulo="Moeda da viagem" value={moeda} onChange={setMoeda} />
        <button
          type="submit"
          disabled={salvando}
          className="gradient-hero shadow-medium tap flex w-full items-center justify-center gap-3 rounded-2xl text-xl font-bold"
        >
          <Check size={28} strokeWidth={2.2} />
          Salvar viagem
        </button>
      </form>
    </div>
  );
}
