import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Topo } from "@/components/Chrome";
import { insertRow } from "@/lib/data";
import { MOEDAS } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { Campo, inputCls } from "@/components/Form";

export const Route = createFileRoute("/nova-viagem")({
  head: () => ({
    meta: [
      { title: "Nova viagem — Evoque Viagens" },
      { name: "description", content: "Cadastre uma viagem com datas e moeda de referência." },
      { property: "og:title", content: "Nova viagem" },
      { property: "og:description", content: "Cadastre uma viagem com datas e moeda de referência." },
    ],
  }),
  component: NovaViagem,
});


function NovaViagem() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [destino, setDestino] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [moeda, setMoeda] = useState("BRL");
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const trip = (await insertRow("trip", {
        owner_id: auth.user?.id,
        nome,
        destino: destino || null,
        data_inicio: inicio,
        data_fim: fim,
        moeda_base: moeda,
        status: "planejada",
      })) as { id: string };
      await qc.invalidateQueries({ queryKey: ["trips"] });
      navigate({ to: "/trip/$id", params: { id: trip.id } });
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
