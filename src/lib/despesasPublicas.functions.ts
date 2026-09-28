import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Acerto, Expense, Membro } from "./data";

export type DespesasPublicas =
  | { ok: true; trip: { nome: string; moeda_base: string; data_inicio: string; data_fim: string }; despesas: Expense[]; acertos: Acerto[]; membros: Membro[] }
  | { ok: false };

/** Leitura pública (só despesas) de uma viagem, a partir de um link do organizador. */
export const verDespesasPublicas = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(20).max(100) }).parse(d))
  .handler(async ({ data }): Promise<DespesasPublicas> => {
    const { adminClient } = await import("./cadastro.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await adminClient()) as any;
    const { data: link } = await db.from("despesas_link").select("trip_id, revogado_em").eq("token", data.token).maybeSingle();
    if (!link || link.revogado_em) return { ok: false };
    const tid = link.trip_id as string;
    const [t, e, s, m] = await Promise.all([
      db.from("trip").select("nome, moeda_base, data_inicio, data_fim, deleted_at").eq("id", tid).maybeSingle(),
      db.from("expense").select("*, pagadores:expense_payer(*), partes:expense_share(*)").eq("trip_id", tid).is("deleted_at", null)
        .order("data", { ascending: false }).order("created_at", { ascending: false }),
      db.from("settlement").select("*").eq("trip_id", tid).is("deleted_at", null).order("data", { ascending: false }),
      db.from("trip_member").select("id, person_id, papel, status, deleted_at, person:person_id(nome, apelido, kind)").eq("trip_id", tid).is("deleted_at", null),
    ]);
    if (!t.data || t.data.deleted_at) return { ok: false };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const despesas = ((e.data ?? []) as any[]).map((x) => ({
      ...x,
      comprovante_url: null, // recibo não sai no link público
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pagadores: (x.pagadores ?? []).filter((p: any) => !p.deleted_at),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      partes: (x.partes ?? []).filter((p: any) => !p.deleted_at),
    })) as Expense[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const membros: Membro[] = ((m.data ?? []) as any[]).map((r) => ({
      id: r.id, person_id: r.person_id, papel: r.papel, status: r.status,
      nome: r.person?.nome ?? "Alguém", apelido: r.person?.apelido ?? null, nome_como_no_documento: null, kind: r.person?.kind ?? "self", meu: false,
    }));
    return {
      ok: true,
      trip: { nome: t.data.nome, moeda_base: t.data.moeda_base, data_inicio: t.data.data_inicio, data_fim: t.data.data_fim },
      despesas, acertos: (s.data ?? []) as Acerto[], membros,
    };
  });
