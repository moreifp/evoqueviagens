import { get, set } from "idb-keyval";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Fila de edições feitas sem internet. Guardada no IndexedDB e enviada ao voltar a conexão. */
export type Op =
  | { tipo: "update"; tabela: string; id: string; valores: Record<string, unknown> }
  | { tipo: "insert"; tabela: string; valores: Record<string, unknown> }
  | { tipo: "upsert"; tabela: string; valores: Record<string, unknown>; onConflict: string };

const CHAVE = "evoque-outbox";
const ouvintes = new Set<(n: number) => void>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any };

async function ler(): Promise<Op[]> {
  return ((await get(CHAVE)) as Op[] | undefined) ?? [];
}
async function gravar(ops: Op[]) {
  await set(CHAVE, ops);
  ouvintes.forEach((f) => f(ops.length));
}

async function executar(op: Op) {
  let r;
  if (op.tipo === "update") r = await db.from(op.tabela).update(op.valores).eq("id", op.id);
  else if (op.tipo === "insert") r = await db.from(op.tabela).insert(op.valores);
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
        console.error("Descartada edição inválida", e);
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
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      ouvintes.delete(setPendentes);
    };
  }, []);
  return { online, pendentes };
}
