/**
 * Ações da caixa "Chegou pelo Claude" no aparelho. Confirmar usa a MESMA camada de escrita
 * dos formulários (montarOps*) e vai pela fila offline junto com a baixa da caixa.
 */
import type { QueryClient } from "@tanstack/react-query";
import type { Op } from "./outbox";
import type { ItemCaixa, ItemRoteiro } from "./data";
import { enviar, montarOpsHotel, montarOpsReserva, montarOpsVoo, naTela, noRoteiro, type HotelValores, type PaxLinha, type QuartoLinha, type ReservaValores, type VooValores, type PessoaReservaLinha } from "./itens";

type PV = { id: string; valores: VooValores; passageiros: PaxLinha[] };
type PH = { id: string; valores: HotelValores; quartos: QuartoLinha[] };
type PR = { id: string; valores: ReservaValores; pessoas: PessoaReservaLinha[] };

/** Operações do item + baixa na caixa, em ordem. */
export function opsDaCaixa(item: ItemCaixa, tripId: string): Op[] {
  const p = item.payload_json as unknown;
  const marca = { origem: "agente" };
  let ops: Op[];
  if (item.tipo_alvo === "voo") {
    const x = p as PV;
    ops = montarOpsVoo({ tripId, id: x.id, valores: { ...x.valores, ...marca } as VooValores, passageiros: x.passageiros });
  } else if (item.tipo_alvo === "hotel") {
    const x = p as PH;
    ops = montarOpsHotel({ tripId, id: x.id, valores: { ...x.valores, ...marca } as HotelValores, quartos: x.quartos });
  } else if (item.tipo_alvo === "reserva") {
    const x = p as PR;
    ops = montarOpsReserva({ tripId, id: x.id, valores: { ...x.valores, ...marca } as ReservaValores, pessoas: x.pessoas });
  } else throw new Error("Tipo ainda não suportado.");
  return [...ops, baixa(item.id, "confirmado", x(item).id, tripId)];
}
const x = (i: ItemCaixa) => i.payload_json as { id: string };

export function baixa(inboxId: string, status: "confirmado" | "descartado", itemId: string | null, tripId?: string): Op {
  return { tipo: "update", tabela: "agent_inbox", id: inboxId, valores: { status, item_id: itemId, resolvido_em: new Date().toISOString(), ...(tripId ? { trip_id: tripId } : {}) } };
}

function tirarDaCaixa(qc: QueryClient, id: string) {
  naTela<ItemCaixa>(qc, ["caixa-claude"], (l) => l.filter((i) => i.id !== id));
}

/** Item no roteiro guardado (aparece na hora, com ou sem internet). */
function paraRoteiro(item: ItemCaixa): ItemRoteiro | null {
  const base = { origem_iata: null, destino_iata: null, companhia: null, numero: null, pessoas: [], detalhe: true, editar: true } as const;
  if (item.tipo_alvo === "voo") {
    const v = (item.payload_json as unknown as PV).valores;
    return { ...base, item_tipo: "ticket", item_id: x(item).id, subtipo: v.tipo, titulo: `${v.origem_iata ?? v.origem_cidade ?? "?"} → ${v.destino_iata ?? v.destino_cidade ?? "?"}`, inicio_utc: v.partida_utc, inicio_tz: v.partida_tz, fim_utc: v.chegada_utc, fim_tz: v.chegada_tz, cidade: v.destino_cidade, origem_iata: v.origem_iata, destino_iata: v.destino_iata, companhia: v.companhia, numero: v.numero, pessoas: [] };
  }
  if (item.tipo_alvo === "hotel") {
    const v = (item.payload_json as unknown as PH).valores;
    return { ...base, item_tipo: "lodging", item_id: x(item).id, subtipo: "hotel", titulo: v.nome, inicio_utc: v.checkin, inicio_tz: "UTC", fim_utc: v.checkout, fim_tz: "UTC", cidade: v.cidade, pessoas: [] };
  }
  if (item.tipo_alvo === "reserva") {
    const v = (item.payload_json as unknown as PR).valores;
    return { ...base, item_tipo: "reservation", item_id: x(item).id, subtipo: v.tipo, titulo: v.titulo, inicio_utc: v.inicio_utc, inicio_tz: v.inicio_tz, fim_utc: v.fim_utc, fim_tz: v.fim_tz, cidade: v.cidade, pessoas: [] };
  }
  return null;
}

export async function confirmarItem(qc: QueryClient, item: ItemCaixa, tripId: string) {
  const ops = opsDaCaixa(item, tripId);
  tirarDaCaixa(qc, item.id);
  const rot = paraRoteiro(item);
  if (rot) noRoteiro(qc, tripId, rot);
  try {
    const r = await enviar(ops);
    if (r === "salvo") for (const k of ["roteiro", "tickets", "lodgings", "reservas", "caixa-claude"]) void qc.invalidateQueries({ queryKey: k === "caixa-claude" ? [k] : [k, tripId] });
    return r;
  } catch (e) {
    void qc.invalidateQueries({ queryKey: ["caixa-claude"] });
    void qc.invalidateQueries({ queryKey: ["roteiro", tripId] });
    throw e;
  }
}

export async function descartarItem(qc: QueryClient, item: ItemCaixa) {
  tirarDaCaixa(qc, item.id);
  try {
    return await enviar([baixa(item.id, "descartado", null)]);
  } catch (e) {
    void qc.invalidateQueries({ queryKey: ["caixa-claude"] });
    throw e;
  }
}

/* ── Editar: abre o formulário preenchido; ao salvar, o pendente vira confirmado ── */
const chaveEd = (tripId: string) => `evoque-claude-edit-${tripId}`;
export type EdicaoClaude = { inboxId: string; tipo: ItemCaixa["tipo_alvo"]; payload: ItemCaixa["payload_json"] };

export function abrirEdicao(item: ItemCaixa, tripId: string) {
  sessionStorage.setItem(chaveEd(tripId), JSON.stringify({ inboxId: item.id, tipo: item.tipo_alvo, payload: item.payload_json } satisfies EdicaoClaude));
  return item.tipo_alvo === "voo" ? "bilhetes/novo" : item.tipo_alvo === "hotel" ? "hospedagem/nova" : "reservas/nova";
}

export function lerEdicao(tripId: string, tipo: ItemCaixa["tipo_alvo"]): EdicaoClaude | null {
  const raw = sessionStorage.getItem(chaveEd(tripId));
  if (!raw) return null;
  const e = JSON.parse(raw) as EdicaoClaude;
  if (e.tipo !== tipo) return null;
  sessionStorage.removeItem(chaveEd(tripId));
  return e;
}
