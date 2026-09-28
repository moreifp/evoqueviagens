import { useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { mutar } from "./outbox";
import { expensesQuery, type Expense, type Membro } from "./data";

/** Id da conta logada (undefined enquanto carrega). */
export function useUid() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  useEffect(() => { void supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null)); }, []);
  return uid;
}

export const nomeCurto = (membros: Membro[], pid: string | null | undefined) => {
  const m = membros.find((x) => x.person_id === pid);
  return m ? (m.apelido || m.nome.split(/\s+/)[0] || m.nome) : "Alguém";
};

/** Nome completo (para as iniciais do avatar: 1º nome + sobrenome). */
export const nomeCompleto = (membros: Membro[], pid: string | null | undefined) => {
  const m = membros.find((x) => x.person_id === pid);
  return m?.nome ?? "Alguém";
};

const CHAVE_TAXA = (de: string, para: string) => `evoque-taxa-${de}-${para}`;
export function guardarTaxa(de: string, para: string, taxa: number, data: string) {
  try { localStorage.setItem(CHAVE_TAXA(de, para), JSON.stringify({ taxa, data })); } catch { /* sem espaço */ }
}
export function ultimaTaxa(de: string, para: string): { taxa: number; data: string } | null {
  try { return JSON.parse(localStorage.getItem(CHAVE_TAXA(de, para)) ?? "null"); } catch { return null; }
}

/** Apaga (soft delete) com Desfazer por 10 s. */
export async function apagarDespesa(qc: QueryClient, tripId: string, id: string) {
  const key = expensesQuery(tripId).queryKey;
  const antes = qc.getQueryData<Expense[]>(key);
  qc.setQueryData<Expense[]>(key, (l) => (l ?? []).filter((e) => e.id !== id));
  await mutar({ tipo: "update", tabela: "expense", id, valores: { deleted_at: new Date().toISOString() } });
  toast("Despesa apagada", {
    duration: 10_000,
    action: {
      label: "Desfazer",
      onClick: async () => {
        if (antes) qc.setQueryData(key, antes);
        await mutar({ tipo: "update", tabela: "expense", id, valores: { deleted_at: null } });
        void qc.invalidateQueries({ queryKey: key });
      },
    },
  });
}

/** Impressão curta da foto do recibo: liga o texto lido à foto certa. */
export function impressao(ref: string | null | undefined) {
  if (!ref) return null;
  let h = 2166136261;
  for (let i = 0; i < ref.length; i += Math.max(1, Math.floor(ref.length / 4096))) h = Math.imul(h ^ ref.charCodeAt(i), 16777619);
  return `${ref.length}:${(h >>> 0).toString(36)}`;
}
