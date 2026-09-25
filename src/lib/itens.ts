import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { enfileirar, mutar, type Op } from "./outbox";

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
export function naTela<T extends { id: string }>(qc: QueryClient, key: QueryKey, f: (l: T[]) => T[]) {
  void qc.cancelQueries({ queryKey: key });
  qc.setQueryData<T[]>(key, (l) => f(l ?? []));
}

export const aviso = (r: "salvo" | "fila", ok: string) => (r === "fila" ? "Sem internet · salvo no aparelho" : ok);
