import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { enfileirar, mutar, type Op } from "./outbox";
import type { ItemRoteiro } from "./data";

/**
 * Gravação de itens da viagem com linhas filhas (passageiros, quartos, hóspedes, pessoas da reserva).
 * Ids são gerados no aparelho: as operações entram em ordem na fila offline e funcionam sem internet.
 */
export const novoId = () => crypto.randomUUID();

type Linha = { id: string } & Record<string, unknown>;

/** Envia uma lista de operações em ordem. Se uma for para a fila, as seguintes também vão (mantém a ordem). */
export async function enviar(ops: Op[]): Promise<"salvo" | "fila"> {
  let resultado: "salvo" | "fila" = "salvo";
  for (const op of ops) {
    if (resultado === "fila") {
      await enfileirar(op);
      continue;
    }
    resultado = await mutar(op);
  }
  return resultado;
}

/** Diferença entre filhos antigos e novos → inserts, updates (só o que mudou) e soft deletes. */
export function diffFilhos(tabela: string, antes: Linha[], depois: Linha[], campos: string[], fixo: Record<string, unknown>): Op[] {
  const ops: Op[] = [];
  const porId = new Map(antes.map((a) => [a.id, a]));
  for (const d of depois) {
    const a = porId.get(d.id);
    if (!a) {
      ops.push({ tipo: "insert", tabela, valores: { id: d.id, ...fixo, ...Object.fromEntries(campos.map((c) => [c, d[c] ?? null])) } });
      continue;
    }
    const mud: Record<string, unknown> = {};
    for (const c of campos) if ((a[c] ?? null) !== (d[c] ?? null)) mud[c] = d[c] ?? null;
    if (Object.keys(mud).length) ops.push({ tipo: "update", tabela, id: d.id, valores: mud });
  }
  const ficam = new Set(depois.map((d) => d.id));
  const agora = new Date().toISOString();
  for (const a of antes) if (!ficam.has(a.id)) ops.push({ tipo: "update", tabela, id: a.id, valores: { deleted_at: agora } });
  return ops;
}

/** Só os campos que mudaram. */
export function diffCampos(antes: Record<string, unknown> | null, depois: Record<string, unknown>) {
  if (!antes) return depois;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(depois)) if ((antes[k] ?? null) !== (v ?? null)) out[k] = v;
  return out;
}

/** Atualiza uma lista em cache na hora (com ou sem internet). */
export function naTela<T>(qc: QueryClient, key: QueryKey, f: (l: T[]) => T[]) {
  void qc.cancelQueries({ queryKey: key });
  qc.setQueryData<T[]>(key, (l) => f(l ?? []));
}

export const aviso = (r: "salvo" | "fila", ok: string) => (r === "fila" ? "Sem internet · salvo no aparelho" : ok);

/** Coloca/atualiza um item no roteiro guardado (para lista, auditor e offline). */
export function noRoteiro(qc: QueryClient, tripId: string, item: ItemRoteiro) {
  naTela<ItemRoteiro>(qc, ["roteiro", tripId], (l) =>
    [...l.filter((x) => x.item_id !== item.item_id), item].sort((a, b) => a.inicio_utc.localeCompare(b.inicio_utc)),
  );
}

export function tiraDoRoteiro(qc: QueryClient, tripId: string, itemId: string) {
  naTela<ItemRoteiro>(qc, ["roteiro", tripId], (l) => l.filter((x) => x.item_id !== itemId));
}

/* ── Camada de escrita única dos itens da viagem ─────────────────────────────
 * Usada pelos formulários e pela confirmação da caixa "Chegou pelo Claude".
 * Recebe os valores já no formato das colunas e devolve as operações em ordem.
 */
type Filho = { id: string } & Record<string, unknown>;
type Antes<T> = (T & { id: string }) | null | undefined;

export type VooValores = {
  tipo: string; companhia: string | null; numero: string | null; localizador: string | null; grupo_reserva: string | null;
  origem_iata: string | null; destino_iata: string | null; origem_cidade: string | null; destino_cidade: string | null;
  partida_utc: string; partida_tz: string; chegada_utc: string; chegada_tz: string;
  bag_mao_qtd?: number | null; bag_mao_kg?: number | null; item_pessoal?: boolean | null; bag_desp_qtd?: number | null; bag_desp_kg?: number | null;
};
export type PaxLinha = { id: string; person_id: string; nome_no_bilhete: string | null; assento: string | null; eticket: string | null; localizador?: string | null; classe?: string | null; loyalty_account_id?: string | null; bag_mao_qtd?: number | null; bag_mao_kg?: number | null; item_pessoal?: boolean | null; bag_desp_qtd?: number | null; bag_desp_kg?: number | null };

export function montarOpsVoo(a: { tripId: string; id: string; valores: VooValores; passageiros: PaxLinha[]; inicial?: Antes<{ passageiros?: unknown[] }> }): Op[] {
  const ops: Op[] = [];
  if (!a.inicial) ops.push({ tipo: "insert", tabela: "ticket", valores: { id: a.id, trip_id: a.tripId, ...a.valores } });
  else {
    const mud = diffCampos(a.inicial as unknown as Record<string, unknown>, a.valores);
    if (Object.keys(mud).length) ops.push({ tipo: "update", tabela: "ticket", id: a.id, valores: mud });
  }
  const tem = (k: string) => a.passageiros.some((p) => k in p);
  ops.push(...diffFilhos("ticket_passenger", (a.inicial?.passageiros ?? []) as Filho[], a.passageiros, ["person_id", "nome_no_bilhete", "assento", "eticket", ...(tem("localizador") ? ["localizador"] : []), ...(tem("classe") ? ["classe"] : []), ...(tem("bag_mao_qtd") ? ["bag_mao_qtd", "bag_mao_kg", "item_pessoal", "bag_desp_qtd", "bag_desp_kg"] : [])], { ticket_id: a.id }));
  return ops;
}

export type HotelValores = {
  nome: string; endereco: string | null; cidade: string | null; checkin: string; checkout: string; localizador: string | null; telefone: string | null;
  valor: number | null; moeda: string | null; politica_cancelamento: string | null; cancelamento_gratis_ate: string | null;
  lat: number | null; lng: number | null; place_id: string | null; site: string | null; tz: string;
};
export type QuartoLinha = { id: string; nome: string; tipo: string | null; hospedes: { id: string; person_id: string }[] };

export function montarOpsHotel(a: { tripId: string; id: string; valores: HotelValores; quartos: QuartoLinha[]; inicial?: Antes<{ quartos?: { id: string; hospedes: unknown[] }[] }> }): Op[] {
  const ops: Op[] = [];
  if (!a.inicial) ops.push({ tipo: "insert", tabela: "lodging", valores: { id: a.id, trip_id: a.tripId, ...a.valores } });
  else {
    const mud = diffCampos(a.inicial as unknown as Record<string, unknown>, a.valores);
    if (Object.keys(mud).length) ops.push({ tipo: "update", tabela: "lodging", id: a.id, valores: mud });
  }
  const antesQ = a.inicial?.quartos ?? [];
  ops.push(...diffFilhos("lodging_room", antesQ as unknown as Filho[], a.quartos.map((q) => ({ id: q.id, nome: q.nome, tipo: q.tipo })), ["nome", "tipo"], { lodging_id: a.id }));
  for (const q of a.quartos) {
    const anteriores = antesQ.find((x) => x.id === q.id)?.hospedes ?? [];
    ops.push(...diffFilhos("lodging_guest", anteriores as Filho[], q.hospedes.filter((g) => g.person_id), ["person_id"], { room_id: q.id }));
  }
  return ops;
}

export type ReservaValores = {
  tipo: string; titulo: string; inicio_utc: string; inicio_tz: string; fim_utc: string | null; fim_tz: string | null;
  local: string | null; telefone: string | null; cidade: string | null; localizador: string | null; valor: number | null; moeda: string | null;
  lat: number | null; lng: number | null; place_id: string | null; site: string | null;
};
export type PessoaReservaLinha = { id: string; person_id: string; papel: string | null };

export function montarOpsReserva(a: { tripId: string; id: string; valores: ReservaValores; pessoas: PessoaReservaLinha[]; inicial?: Antes<{ pessoas?: unknown[] }> }): Op[] {
  const ops: Op[] = [];
  if (!a.inicial) ops.push({ tipo: "insert", tabela: "reservation", valores: { id: a.id, trip_id: a.tripId, ...a.valores } });
  else {
    const mud = diffCampos(a.inicial as unknown as Record<string, unknown>, a.valores);
    if (Object.keys(mud).length) ops.push({ tipo: "update", tabela: "reservation", id: a.id, valores: mud });
  }
  ops.push(...diffFilhos("reservation_person", (a.inicial?.pessoas ?? []) as Filho[], a.pessoas, ["person_id", "papel"], { reservation_id: a.id }));
  return ops;
}
