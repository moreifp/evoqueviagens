import { get, set } from "idb-keyval";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Fila de edições feitas sem internet. Guardada no IndexedDB e enviada ao voltar a conexão. */
export type Op =
  | { tipo: "update"; tabela: string; id: string; valores: Record<string, unknown> }
  | { tipo: "insert"; tabela: string; valores: Record<string, unknown> }
  | { tipo: "upsert"; tabela: string; valores: Record<string, unknown>; onConflict: string }
  | { tipo: "rpc"; funcao: string; args: Record<string, unknown> };

const CHAVE = "evoque-outbox";
const ouvintes = new Set<(n: number) => void>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a: unknown) => any };

async function ler(): Promise<Op[]> {
  return ((await get(CHAVE)) as Op[] | undefined) ?? [];
}
async function gravar(ops: Op[]) {
  await set(CHAVE, ops);
  ouvintes.forEach((f) => f(ops.length));
}

async function executar(op: Op) {
  // Uma chamada presa (rede caiu no meio) não pode travar a fila para sempre.
  let limite: ReturnType<typeof setTimeout> | undefined;
  const tempo = new Promise<never>((_, rej) => {
    limite = setTimeout(() => rej(new Error("network timeout")), 15_000);
  });
  try {
    await Promise.race([executarAgora(op), tempo]);
  } finally {
    clearTimeout(limite);
  }
}

async function executarAgora(op: Op) {
  let r;
  if (op.tipo === "update") r = await db.from(op.tabela).update(op.valores).eq("id", op.id);
  else if (op.tipo === "insert") r = await db.from(op.tabela).insert(op.valores);
  else if (op.tipo === "rpc") r = await db.rpc(op.funcao, op.args);
  else r = await db.from(op.tabela).upsert(op.valores, { onConflict: op.onConflict });
  if (r.error) throw Object.assign(new Error(r.error.message), { rede: false });
}

function ehErroDeRede(e: unknown) {
  const m = String((e as Error)?.message ?? "").toLowerCase();
  return !navigator.onLine || m.includes("fetch") || m.includes("network");
}

/** Tenta enviar agora; sem internet, guarda no aparelho. Retorna "salvo" ou "fila". */
export async function mutar(op: Op): Promise<"salvo" | "fila"> {
  if (navigator.onLine) {
    try {
      await executar(op);
      return "salvo";
    } catch (e) {
      if (!ehErroDeRede(e)) throw e;
    }
  }
  await gravar([...(await ler()), op]);
  return "fila";
}

/** Coloca direto na fila (usado para manter a ordem quando uma operação anterior ficou na fila). */
export async function enfileirar(op: Op) {
  await gravar([...(await ler()), op]);
}

let enviando = false;
export async function sincronizar() {
  if (enviando || !navigator.onLine) return;
  enviando = true;
  try {
    let ops = await ler();
    let enviadas = 0;
    while (ops.length) {
      try {
        await executar(ops[0]!);
      } catch (e) {
        if (ehErroDeRede(e)) break;
        console.error("Edição recusada", e);
        await guardarFalha(ops[0]!, String((e as Error)?.message ?? e));
      }
      enviadas++;
      ops = ops.slice(1);
      await gravar(ops);
    }
    if (enviadas > 0) window.dispatchEvent(new Event("evoque-sincronizado"));
  } finally {
    enviando = false;
  }
}

export function useConexao() {
  const [online, setOnline] = useState(true);
  const [pendentes, setPendentes] = useState(0);
  useEffect(() => {
    setOnline(navigator.onLine);
    ler().then((o) => setPendentes(o.length));
    const on = () => {
      setOnline(true);
      sincronizar();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    ouvintes.add(setPendentes);
    sincronizar();
    const repetir = setInterval(() => void sincronizar(), 20_000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      ouvintes.delete(setPendentes);
      clearInterval(repetir);
    };
  }, []);
  return { online, pendentes };
}

/** Edições recusadas pelo servidor ao sincronizar: ficam guardadas para o usuário decidir. */
export type Falha = { op: Op; erro: string; em: string };
const CHAVE_FALHAS = "evoque-outbox-falhas";
const ouvintesFalha = new Set<(f: Falha[]) => void>();
async function lerFalhas(): Promise<Falha[]> {
  return ((await get(CHAVE_FALHAS)) as Falha[] | undefined) ?? [];
}
async function gravarFalhas(f: Falha[]) {
  await set(CHAVE_FALHAS, f);
  ouvintesFalha.forEach((x) => x(f));
}
async function guardarFalha(op: Op, erro: string) {
  await gravarFalhas([...(await lerFalhas()), { op, erro, em: new Date().toISOString() }]);
}
const NOMES: Record<string, string> = {
  person: "dados pessoais", trip: "viagem", trip_member: "participante", ticket: "transporte", ticket_passenger: "passageiro",
  lodging: "hospedagem", reservation: "reserva", expense: "despesa", traveler_document: "documento", loyalty_account: "fidelidade",
};
export function nomeFalha(f: Falha) {
  const t = f.op.tipo === "rpc" ? f.op.funcao : f.op.tabela;
  return NOMES[t] ?? "uma edição";
}
export async function tentarFalha(i: number) {
  const lista = await lerFalhas();
  const f = lista[i];
  if (!f) return;
  try {
    await executar(f.op);
    await gravarFalhas(lista.filter((_, j) => j !== i));
    window.dispatchEvent(new Event("evoque-sincronizado"));
    return true;
  } catch (e) {
    lista[i] = { ...f, erro: String((e as Error)?.message ?? e) };
    await gravarFalhas(lista);
    return false;
  }
}
export async function descartarFalha(i: number) {
  await gravarFalhas((await lerFalhas()).filter((_, j) => j !== i));
}
export function useFalhas() {
  const [f, setF] = useState<Falha[]>([]);
  useEffect(() => {
    lerFalhas().then(setF);
    ouvintesFalha.add(setF);
    return () => { ouvintesFalha.delete(setF); };
  }, []);
  return f;
}
