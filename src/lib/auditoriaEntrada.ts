/** Parte pura da entrada do auditor (roda no aparelho e no servidor). */
import type { ItemRoteiro, Membro, Ticket } from "./data";
import type { LodgingLite, PessoasCtx, TicketLite } from "./audit";

/** Entrada do auditor a partir do roteiro (todos os itens, mesmo os que a pessoa só vê em resumo). */
export function montarEntrada(roteiro: ItemRoteiro[], detalhados: Ticket[], membros: Membro[]) {
  const det = new Map(detalhados.map((t) => [t.id, t]));
  const bilhetes: TicketLite[] = roteiro
    .filter((r) => r.item_tipo === "ticket")
    .map((r) => ({
      id: r.item_id,
      tipo: r.subtipo,
      companhia: r.companhia,
      numero: r.numero,
      origem_iata: r.origem_iata,
      destino_iata: r.destino_iata,
      origem_cidade: det.get(r.item_id)?.origem_cidade ?? null,
      destino_cidade: r.cidade,
      partida_utc: r.inicio_utc,
      partida_tz: r.inicio_tz,
      chegada_utc: r.fim_utc ?? r.inicio_utc,
      chegada_tz: r.fim_tz ?? r.inicio_tz,
    }));
  const hospedagens: LodgingLite[] = roteiro
    .filter((r) => r.item_tipo === "lodging")
    .map((r) => ({ id: r.item_id, nome: r.titulo, cidade: r.cidade, checkin: r.inicio_utc, checkout: r.fim_utc ?? r.inicio_utc }));
  const ctx: PessoasCtx = {
    membros: membros.map((m) => ({ person_id: m.person_id, nome: m.apelido || m.nome, nome_como_no_documento: m.nome_como_no_documento })),
    passageiros: Object.fromEntries(
      roteiro
        .filter((r) => r.item_tipo === "ticket")
        .map((r) => [
          r.item_id,
          r.pessoas.map((p) => ({ person_id: p.id, nome_no_bilhete: det.get(r.item_id)?.passageiros.find((x) => x.person_id === p.id)?.nome_no_bilhete ?? null })),
        ]),
    ),
    hospedes: Object.fromEntries(roteiro.filter((r) => r.item_tipo === "lodging").map((r) => [r.item_id, r.pessoas.map((p) => p.id)])),
  };
  return { bilhetes, hospedagens, ctx };
}

