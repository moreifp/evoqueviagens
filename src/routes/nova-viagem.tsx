import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Topo } from "@/components/Chrome";
import { membersQuery, reservasQuery, tripQuery, tripsQuery, type Trip } from "@/lib/data";
import { MOEDAS } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { Campo, inputCls } from "@/components/Form";
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
  validateSearch: (s: Record<string, unknown>): { duplicar?: string } => typeof s.duplicar === "string" ? { duplicar: s.duplicar } : {},
  component: NovaViagem,
});


function NovaViagem() {
  const navigate = useNavigate();
  const { duplicar } = Route.useSearch();
  const qc = useQueryClient();
  const { data: origem } = useQuery({ ...tripQuery(duplicar ?? ""), enabled: Boolean(duplicar) });
  const { data: membros = [] } = useQuery({ ...membersQuery(duplicar ?? ""), enabled: Boolean(duplicar) });
  const { data: reservas = [] } = useQuery({ ...reservasQuery(duplicar ?? ""), enabled: Boolean(duplicar) });
  const [nome, setNome] = useState(() => duplicar ? "Cópia da viagem" : "");
  const [destino, setDestino] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [moeda, setMoeda] = useState("BRL");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (!origem) return;
    setNome(`Cópia de ${origem.nome}`);
    setDestino(origem.cidades?.join(", ") || origem.destino || "");
    setMoeda(origem.moeda_base);
  }, [origem]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const tripId = novoId();
      const ops: Op[] = [{ tipo: "insert", tabela: "trip", valores: {
        id: tripId,
        owner_id: auth.user?.id,
        nome,
        destino: destino || null,
        cidades: destino ? destino.split(",").map((x) => x.trim()).filter(Boolean) : [],
        data_inicio: inicio,
        data_fim: fim,
        moeda_base: moeda,
        status: "planejada",
      } }];
      if (origem) {
        for (const m of membros.filter((x) => x.papel !== "owner")) ops.push({ tipo: "insert", tabela: "trip_member", valores: { id: novoId(), trip_id: tripId, person_id: m.person_id, papel: m.papel, status: m.status } });
        const delta = Date.parse(`${inicio}T12:00:00Z`) - Date.parse(`${origem.data_inicio}T12:00:00Z`);
        for (const r of reservas) {
          const rid = novoId();
          const deslocar = (iso: string | null) => iso ? new Date(Date.parse(iso) + delta).toISOString() : null;
          ops.push({ tipo: "insert", tabela: "reservation", valores: { id: rid, trip_id: tripId, tipo: r.tipo, titulo: r.titulo, inicio_utc: deslocar(r.inicio_utc), inicio_tz: r.inicio_tz, fim_utc: deslocar(r.fim_utc), fim_tz: r.fim_tz, local: r.local, cidade: r.cidade, localizador: r.localizador, valor: r.valor, moeda: r.moeda, origem: "ui" } });
          for (const p of r.pessoas) ops.push({ tipo: "insert", tabela: "reservation_person", valores: { id: novoId(), reservation_id: rid, person_id: p.person_id, papel: p.papel } });
        }
      }
      const resultado = await enviar(ops);
      const nova = { id: tripId, owner_id: auth.user?.id ?? "", nome, destino: destino || null, cidades: destino ? destino.split(",").map((x) => x.trim()).filter(Boolean) : [], data_inicio: inicio, data_fim: fim, moeda_base: moeda, status: "planejada", capa_url: null, arquivada_em: null, created_at: new Date().toISOString(), deleted_at: null } satisfies Trip;
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
      <Topo titulo="Nova viagem" voltarPara="/viagens" />
      <form onSubmit={salvar} className="space-y-5 px-4 pt-4">
        <Campo rotulo="Nome">
          <input required value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} />
        </Campo>
        <Campo rotulo="Destino">
          <input value={destino} onChange={(e) => setDestino(e.target.value)} className={inputCls} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Início">
            <input type="date" required value={inicio} onChange={(e) => setInicio(e.target.value)} className={inputCls} />
          </Campo>
          <Campo rotulo="Fim">
            <input type="date" required value={fim} onChange={(e) => setFim(e.target.value)} className={inputCls} />
          </Campo>
        </div>
        <Campo rotulo="Moeda da viagem">
          <select value={moeda} onChange={(e) => setMoeda(e.target.value)} className={inputCls}>
            {MOEDAS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Campo>
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
