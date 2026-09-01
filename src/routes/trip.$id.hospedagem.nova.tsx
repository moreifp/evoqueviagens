import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Topo } from "@/components/Chrome";
import { insertRow, lodgingsQuery, ticketsQuery, tripQuery } from "@/lib/data";
import { MOEDAS } from "@/lib/format";
import { Campo, inputCls } from "@/components/Form";
import { rodarAuditor } from "@/lib/audit";
import { avisarNovoAchado } from "@/lib/auditoria";

export const Route = createFileRoute("/trip/$id/hospedagem/nova")({
  head: () => ({
    meta: [
      { title: "Nova estadia — Evoque Viagens" },
      { name: "description", content: "Cadastre hotel com entrada, saída e localizador." },
      { property: "og:title", content: "Nova estadia" },
      { property: "og:description", content: "Cadastre hotel com entrada, saída e localizador." },
    ],
  }),
  component: NovaEstadia,
});

function NovaEstadia() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState({
    nome: "",
    endereco: "",
    cidade: "",
    checkin: "",
    checkout: "",
    localizador: "",
    valor: "",
    moeda: "BRL",
    politica_cancelamento: "",
  });
  const [salvando, setSalvando] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((v) => ({ ...v, [k]: e.target.value }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const trip = await qc.fetchQuery(tripQuery(id));
      const tks = await qc.fetchQuery(ticketsQuery(id));
      const antesH = await qc.fetchQuery(lodgingsQuery(id));
      const antes = rodarAuditor(trip, tks, antesH);

      await insertRow("lodging", {
        trip_id: id,
        nome: f.nome,
        endereco: f.endereco || null,
        cidade: f.cidade || null,
        checkin: new Date(f.checkin).toISOString(),
        checkout: new Date(f.checkout).toISOString(),
        localizador: f.localizador || null,
        valor: f.valor ? Number(f.valor.replace(",", ".")) : null,
        moeda: f.moeda,
        politica_cancelamento: f.politica_cancelamento || null,
      });
      await qc.invalidateQueries({ queryKey: ["lodgings", id] });
      const depoisH = await qc.fetchQuery(lodgingsQuery(id));
      avisarNovoAchado(antes, rodarAuditor(trip, tks, depoisH), () =>
        navigate({ to: "/trip/$id/revisao", params: { id } }),
      );
      navigate({ to: "/trip/$id/hospedagem", params: { id } });
    } catch (err) {
      toast.error((err as Error).message);
      setSalvando(false);
    }
  }

  return (
    <>
      <Topo titulo="Nova estadia" voltarPara="/trip/$id/hospedagem" voltarParams={{ id }} />
      <form onSubmit={salvar} className="space-y-4 px-4 pt-4">
        <Campo rotulo="Nome">
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
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Valor">
            <input inputMode="decimal" value={f.valor} onChange={set("valor")} className={inputCls} />
          </Campo>
          <Campo rotulo="Moeda">
            <select value={f.moeda} onChange={set("moeda")} className={inputCls}>
              {MOEDAS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <button
          type="submit"
          disabled={salvando}
          className="gradient-hero shadow-medium tap flex w-full items-center justify-center gap-3 rounded-2xl text-xl font-bold"
        >
          <Check size={28} strokeWidth={2.2} />
          Salvar estadia
        </button>
      </form>
    </>
  );
}
