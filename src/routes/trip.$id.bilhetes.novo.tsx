import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Topo } from "@/components/Chrome";
import { insertRow, lodgingsQuery, ticketsQuery, tripQuery } from "@/lib/data";
import { fusoLocal } from "@/lib/format";
import { Campo, inputCls } from "@/components/Form";
import { rodarAuditor } from "@/lib/audit";
import { avisarNovoAchado } from "@/lib/auditoria";

export const Route = createFileRoute("/trip/$id/bilhetes/novo")({
  head: () => ({
    meta: [
      { title: "Novo bilhete — Evoque Viagens" },
      { name: "description", content: "Cadastre voo, trem, ônibus ou transfer com fuso correto." },
      { property: "og:title", content: "Novo bilhete" },
      { property: "og:description", content: "Cadastre voo, trem, ônibus ou transfer com fuso correto." },
    ],
  }),
  component: NovoBilhete,
});

const FUSOS = [
  "America/Sao_Paulo",
  "America/New_York",
  "America/Los_Angeles",
  "America/Buenos_Aires",
  "Europe/Lisbon",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/London",
  "Asia/Tokyo",
  "Asia/Dubai",
];

function localParaUtc(valor: string, tz: string) {
  // valor: "2026-05-01T22:35" interpretado no fuso tz
  const base = new Date(`${valor}:00Z`);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(base).map((x) => [x.type, x.value]));
  const comoTz = Date.UTC(
    Number(p["year"]),
    Number(p["month"]) - 1,
    Number(p["day"]),
    Number(p["hour"]) % 24,
    Number(p["minute"]),
    Number(p["second"]),
  );
  const offset = comoTz - base.getTime();
  return new Date(base.getTime() - offset).toISOString();
}

function NovoBilhete() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState({
    tipo: "voo",
    companhia: "",
    numero: "",
    localizador: "",
    origem_iata: "",
    destino_iata: "",
    origem_cidade: "",
    destino_cidade: "",
    partida: "",
    partida_tz: fusoLocal(),
    chegada: "",
    chegada_tz: fusoLocal(),
    assento: "",
    nome_no_bilhete: "",
  });
  const [salvando, setSalvando] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((v) => ({ ...v, [k]: e.target.value }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const trip = await qc.fetchQuery(tripQuery(id));
      const antesT = await qc.fetchQuery(ticketsQuery(id));
      const hosp = await qc.fetchQuery(lodgingsQuery(id));
      const antes = rodarAuditor(trip, antesT, hosp);

      await insertRow("ticket", {
        trip_id: id,
        tipo: f.tipo,
        companhia: f.companhia || null,
        numero: f.numero || null,
        localizador: f.localizador || null,
        origem_iata: f.origem_iata ? f.origem_iata.toUpperCase().slice(0, 3) : null,
        destino_iata: f.destino_iata ? f.destino_iata.toUpperCase().slice(0, 3) : null,
        origem_cidade: f.origem_cidade || null,
        destino_cidade: f.destino_cidade || null,
        partida_utc: localParaUtc(f.partida, f.partida_tz),
        partida_tz: f.partida_tz,
        chegada_utc: localParaUtc(f.chegada, f.chegada_tz),
        chegada_tz: f.chegada_tz,
        assento: f.assento || null,
        nome_no_bilhete: f.nome_no_bilhete || null,
      });
      await qc.invalidateQueries({ queryKey: ["tickets", id] });
      const depoisT = await qc.fetchQuery(ticketsQuery(id));
      avisarNovoAchado(antes, rodarAuditor(trip, depoisT, hosp), () =>
        navigate({ to: "/trip/$id/revisao", params: { id } }),
      );
      navigate({ to: "/trip/$id/bilhetes", params: { id } });
    } catch (err) {
      toast.error((err as Error).message);
      setSalvando(false);
    }
  }

  return (
    <>
      <Topo titulo="Novo bilhete" voltarPara="/trip/$id/bilhetes" voltarParams={{ id }} />
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
            <input value={f.companhia} onChange={set("companhia")} className={inputCls} />
          </Campo>
          <Campo rotulo="Número">
            <input value={f.numero} onChange={set("numero")} className={inputCls} />
          </Campo>
        </div>
        <Campo rotulo="Localizador">
          <input value={f.localizador} onChange={set("localizador")} className={`${inputCls} mono-code`} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Origem">
            <input value={f.origem_iata} onChange={set("origem_iata")} placeholder="GRU" className={inputCls} />
          </Campo>
          <Campo rotulo="Destino">
            <input value={f.destino_iata} onChange={set("destino_iata")} placeholder="LIS" className={inputCls} />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Cidade saída">
            <input value={f.origem_cidade} onChange={set("origem_cidade")} className={inputCls} />
          </Campo>
          <Campo rotulo="Cidade chegada">
            <input value={f.destino_cidade} onChange={set("destino_cidade")} className={inputCls} />
          </Campo>
        </div>
        <Campo rotulo="Partida">
          <input type="datetime-local" required value={f.partida} onChange={set("partida")} className={inputCls} />
        </Campo>
        <Campo rotulo="Fuso da partida">
          <select value={f.partida_tz} onChange={set("partida_tz")} className={inputCls}>
            {FUSOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Chegada">
          <input type="datetime-local" required value={f.chegada} onChange={set("chegada")} className={inputCls} />
        </Campo>
        <Campo rotulo="Fuso da chegada">
          <select value={f.chegada_tz} onChange={set("chegada_tz")} className={inputCls}>
            {FUSOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Assento">
            <input value={f.assento} onChange={set("assento")} className={inputCls} />
          </Campo>
          <Campo rotulo="Passageiro">
            <input value={f.nome_no_bilhete} onChange={set("nome_no_bilhete")} className={inputCls} />
          </Campo>
        </div>
        <button
          type="submit"
          disabled={salvando}
          className="gradient-hero shadow-medium tap flex w-full items-center justify-center gap-3 rounded-2xl text-xl font-bold"
        >
          <Check size={28} strokeWidth={2.2} />
          Salvar bilhete
        </button>
      </form>
    </>
  );
}
