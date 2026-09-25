import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { horariosEfetivos } from "./voo";
import { findingsQuery, flightStatusQuery, insertRow, lodgingsQuery, membersQuery, roteiroQuery, ticketsQuery, tripQuery, type ItemRoteiro, type Lodging, type Membro, type Ticket, type Trip } from "./data";
import type { QueryClient } from "@tanstack/react-query";
import { ordenar, rodarAuditor, type Achado, type LodgingLite, type PessoasCtx, type TicketLite } from "./audit";

export function useAuditoria(tripId: string) {
  const { data: trip } = useSuspenseQuery(tripQuery(tripId));
  const { data: detalhados } = useSuspenseQuery(ticketsQuery(tripId));
  const { data: roteiro } = useSuspenseQuery(roteiroQuery(tripId));
  const { data: membros } = useSuspenseQuery(membersQuery(tripId));
  const { data: findings } = useSuspenseQuery(findingsQuery(tripId));
  const { bilhetes, hospedagens, ctx } = montarEntrada(roteiro, detalhados, membros);

  const dispensados = new Set(
    findings.filter((f) => f.dispensado_em).map((f) => `${f.regra_id}:${f.hash_dos_dados}`),
  );

  const { data: status } = useQuery(flightStatusQuery(tripId));
  // Auditor roda com o horário revisto quando houver (atraso que fura check-in/conexão vira achado).
  const efetivos = bilhetes.map((b) => {
    const h = horariosEfetivos(status?.[b.id]);
    return h ? { ...b, partida_utc: h.partida ?? b.partida_utc, chegada_utc: h.chegada ?? b.chegada_utc } : b;
  });
  const todos = ordenar(rodarAuditor(trip, efetivos, hospedagens, ctx));
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

export { montarEntrada } from "./auditoriaEntrada";
import { montarEntrada } from "./auditoriaEntrada";

/** Achados com o que está no aparelho agora (para avisar quando um salvamento cria um achado vermelho). */
export function achadosDoCache(qc: QueryClient, tripId: string): Achado[] {
  const trip = qc.getQueryData<Trip>(tripQuery(tripId).queryKey);
  const roteiro = qc.getQueryData<ItemRoteiro[]>(roteiroQuery(tripId).queryKey);
  if (!trip || !roteiro) return [];
  const { bilhetes, hospedagens, ctx } = montarEntrada(
    roteiro,
    qc.getQueryData<Ticket[]>(ticketsQuery(tripId).queryKey) ?? [],
    qc.getQueryData<Membro[]>(membersQuery(tripId).queryKey) ?? [],
  );
  return rodarAuditor(trip, bilhetes, hospedagens, ctx);
}
