import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Acerto, Expense, Membro } from "./data";

export type DespesasPublicas =
  | { ok: true; trip: { nome: string; moeda_base: string; data_inicio: string; data_fim: string }; despesas: Expense[]; acertos: Acerto[]; membros: Membro[] }
  | { ok: false; motivo?: "expirado" | "limite" };

// Limite simples por token (por instância do servidor): 30 aberturas por minuto.
const acessos = new Map<string, number[]>();
function passouDoLimite(token: string) {
  const agora = Date.now();
  const lista = (acessos.get(token) ?? []).filter((t) => agora - t < 60_000);
  lista.push(agora);
  acessos.set(token, lista);
  if (acessos.size > 500) acessos.clear();
  return lista.length > 30;
}

/** Nome curto para o link público: apelido, ou primeiro nome + inicial do último. */
function nomeCurto(nome: string | null, apelido: string | null) {
  if (apelido?.trim()) return apelido.trim();
  const p = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "Alguém";
  return p.length > 1 ? `${p[0]} ${p[p.length - 1]![0]}.` : p[0]!;
}

/** Leitura pública (só despesas) de uma viagem, a partir de um link do organizador. */
export const verDespesasPublicas = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(20).max(100) }).parse(d))
  .handler(async ({ data }): Promise<DespesasPublicas> => {
    if (passouDoLimite(data.token)) return { ok: false, motivo: "limite" };
    const { adminClient } = await import("./cadastro.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await adminClient()) as any;
    const { data: link } = await db.from("despesas_link").select("trip_id, revogado_em, expira_em").eq("token", data.token).maybeSingle();
    if (!link || link.revogado_em) return { ok: false };
    if (link.expira_em && new Date(link.expira_em).getTime() < Date.now()) return { ok: false, motivo: "expirado" };
    const tid = link.trip_id as string;
    const [t, e, s, m] = await Promise.all([
      db.from("trip").select("nome, moeda_base, data_inicio, data_fim, deleted_at").eq("id", tid).maybeSingle(),
      db.from("expense")
        .select("id, descricao, categoria, data, valor_original, moeda_original, taxa_cambio, valor_moeda_base, taxa_provisoria, divisao, pessoal, created_at, pagadores:expense_payer(person_id, valor_original, valor_moeda_base, deleted_at), partes:expense_share(person_id, peso, valor_moeda_base, deleted_at)")
        .eq("trip_id", tid).is("deleted_at", null).eq("pessoal", false)
        .order("data", { ascending: false }).order("created_at", { ascending: false }),
      db.from("settlement").select("id, de_person_id, para_person_id, valor_moeda_base, data, created_at").eq("trip_id", tid).is("deleted_at", null).order("data", { ascending: false }),
      db.from("trip_member").select("person_id, papel, status, created_at, person:person_id(nome, apelido, kind)").eq("trip_id", tid).is("deleted_at", null),
    ]);
    if (!t.data || t.data.deleted_at) return { ok: false };

    // IDs internos nunca saem: trocados por apelidos opacos só desta resposta.
    const pid = new Map<string, string>();
    const alias = (id: string | null | undefined) => {
      if (!id) return id ?? null;
      if (!pid.has(id)) pid.set(id, `p${pid.size + 1}`);
      return pid.get(id)!;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const membros: Membro[] = ((m.data ?? []) as any[]).map((r) => ({
      id: `m-${alias(r.person_id)}`, person_id: alias(r.person_id)!, papel: r.papel, status: r.status,
      nome: nomeCurto(r.person?.nome ?? null, r.person?.apelido ?? null), apelido: null, nome_como_no_documento: null, kind: r.person?.kind === "dependent" ? "dependent" : "self", meu: false,
    })) as Membro[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const despesas = ((e.data ?? []) as any[]).map((x, i) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pag = (x.pagadores ?? []).filter((p: any) => !p.deleted_at).map((p: any) => ({ person_id: alias(p.person_id), valor_original: p.valor_original, valor_moeda_base: p.valor_moeda_base }));
      return {
        id: `e${i + 1}`, descricao: x.descricao, categoria: x.categoria, data: x.data, valor_original: x.valor_original, moeda_original: x.moeda_original,
        taxa_cambio: x.taxa_cambio, valor_moeda_base: x.valor_moeda_base, taxa_provisoria: x.taxa_provisoria, divisao: x.divisao, pessoal: false, pessoal_de: null,
        pago_por: pag[0]?.person_id ?? null, comprovante_url: null, created_at: x.created_at,
        pagadores: pag,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        partes: (x.partes ?? []).filter((p: any) => !p.deleted_at).map((p: any) => ({ person_id: alias(p.person_id), peso: p.peso, valor_moeda_base: p.valor_moeda_base })),
      };
    }) as unknown as Expense[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const acertos = ((s.data ?? []) as any[]).map((a, i) => ({
      id: `a${i + 1}`, de_person_id: alias(a.de_person_id), para_person_id: alias(a.para_person_id), valor_moeda_base: a.valor_moeda_base, data: a.data, created_at: a.created_at,
    })) as unknown as Acerto[];
    return {
      ok: true,
      trip: { nome: t.data.nome, moeda_base: t.data.moeda_base, data_inicio: t.data.data_inicio, data_fim: t.data.data_fim },
      despesas, acertos, membros,
    };
  });
