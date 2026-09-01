import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { findingsQuery, insertRow, lodgingsQuery, ticketsQuery, tripQuery } from "./data";
import { ordenar, rodarAuditor, type Achado } from "./audit";

export function useAuditoria(tripId: string) {
  const { data: trip } = useSuspenseQuery(tripQuery(tripId));
  const { data: bilhetes } = useSuspenseQuery(ticketsQuery(tripId));
  const { data: hospedagens } = useSuspenseQuery(lodgingsQuery(tripId));
  const { data: findings } = useSuspenseQuery(findingsQuery(tripId));

  const dispensados = new Set(
    findings.filter((f) => f.dispensado_em).map((f) => `${f.regra_id}:${f.hash_dos_dados}`),
  );

  const todos = ordenar(rodarAuditor(trip, bilhetes, hospedagens));
  const visiveis = todos.filter((a) => !dispensados.has(`${a.regra_id}:${a.hash_dos_dados}`));

  return { trip, visiveis, todos };
}

export function useDispensar(tripId: string) {
  const qc = useQueryClient();
  return async (a: Achado) => {
    await insertRow("consistency_finding", {
      trip_id: tripId,
      regra_id: a.regra_id,
      severidade: a.severidade,
      itens_envolvidos: a.itens_envolvidos,
      mensagem: a.mensagem,
      hash_dos_dados: a.hash_dos_dados,
      dispensado_em: new Date().toISOString(),
    }).catch(() => undefined);
    await qc.invalidateQueries({ queryKey: ["findings", tripId] });
  };
}

/** Nunca bloqueia: só avisa por toast quando um salvamento criou um achado vermelho. */
export function avisarNovoAchado(antes: Achado[], depois: Achado[], irPara: () => void) {
  const chaves = new Set(antes.map((a) => `${a.regra_id}:${a.hash_dos_dados}`));
  const novo = depois.find(
    (a) => a.severidade === "resolver" && !chaves.has(`${a.regra_id}:${a.hash_dos_dados}`),
  );
  if (!novo) return;
  toast.warning(novo.mensagem, {
    duration: 8000,
    action: { label: novo.correcao?.rotulo ?? "Ver", onClick: irPara },
  });
}
