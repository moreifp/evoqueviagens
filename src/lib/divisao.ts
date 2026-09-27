/** Regras puras de divisão de despesas e saldos. Tudo em centavos inteiros. */

export type ModoDivisao = "igual" | "valor" | "pct" | "cotas";

export const centavos = (v: number | string) => Math.round(Number(v) * 100);

export type MembroDivisao = { person_id: string; status: string; entrou_em: string; created_at: string; deleted_at?: string | null };

/** D9: só participantes ativos; quem entrou depois da data da despesa fica fora. Ordem estável por created_at. */
export function participantesPadrao<T extends MembroDivisao>(membros: T[], data: string): T[] {
  return membros
    .filter((m) => !m.deleted_at && m.status !== "recusado" && m.status !== "saiu" && m.entrou_em <= data)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/**
 * Divide o total (centavos) entre as pessoas, na ordem dada.
 * igual: peso ignorado. pct/cotas: proporcional ao peso. valor: peso = valor em moeda (vira centavos).
 * Centavo que sobra vai para os primeiros da lista.
 */
export function dividir(totalC: number, pessoas: { id: string; peso: number }[], modo: ModoDivisao) {
  const partes = new Map<string, number>();
  if (!pessoas.length) return { partes, extras: 0, fecha: false, diferencaC: totalC };
  if (modo === "valor") {
    let soma = 0;
    for (const p of pessoas) { const c = centavos(p.peso || 0); partes.set(p.id, c); soma += c; }
    return { partes, extras: 0, fecha: soma === totalC, diferencaC: totalC - soma };
  }
  const pesos = pessoas.map((p) => (modo === "igual" ? 1 : Math.max(0, Number(p.peso) || 0)));
  const somaPesos = pesos.reduce((s, x) => s + x, 0);
  if (modo === "pct" && Math.abs(somaPesos - 100) > 0.001) {
    // % precisa somar 100
    const base = pessoas.map((_, i) => Math.floor((totalC * pesos[i]!) / 100));
    pessoas.forEach((p, i) => partes.set(p.id, base[i]!));
    const soma = base.reduce((s, x) => s + x, 0);
    return { partes, extras: 0, fecha: false, diferencaC: totalC - soma };
  }
  if (somaPesos <= 0) return { partes, extras: 0, fecha: false, diferencaC: totalC };
  const base = pesos.map((w) => Math.floor((totalC * w) / somaPesos));
  let resto = totalC - base.reduce((s, x) => s + x, 0);
  const extras = resto;
  for (let i = 0; resto > 0; i = (i + 1) % pessoas.length) {
    if (pesos[i]! > 0) { base[i]!++; resto--; }
  }
  pessoas.forEach((p, i) => partes.set(p.id, base[i]!));
  return { partes, extras, fecha: true, diferencaC: 0 };
}

export type DespesaSaldo = {
  pessoal?: boolean | null;
  pagadores: { person_id: string; valor_moeda_base: number | string }[];
  partes: { person_id: string; valor_moeda_base: number | string }[];
};
export type AcertoSaldo = { de_person_id: string; para_person_id: string; valor_moeda_base: number | string };

/**
 * Saldo por pessoa em centavos (positivo = tem a receber).
 * saldo = Σ pago − Σ parte + Σ acertos que ELA pagou − Σ acertos que ELA recebeu.
 * Despesa pessoal não entra.
 */
export function saldosDaViagem(despesas: DespesaSaldo[], acertos: AcertoSaldo[] = []) {
  const s: Record<string, number> = {};
  const add = (p: string, c: number) => { s[p] = (s[p] ?? 0) + c; };
  for (const d of despesas) {
    if (d.pessoal) continue;
    for (const p of d.pagadores) add(p.person_id, centavos(p.valor_moeda_base));
    for (const p of d.partes) add(p.person_id, -centavos(p.valor_moeda_base));
  }
  for (const a of acertos) {
    const c = centavos(a.valor_moeda_base);
    add(a.de_person_id, c);
    add(a.para_person_id, -c);
  }
  return s;
}

/** Guloso: o maior devedor paga ao maior credor, até zerar. */
export function simplificarDividas(saldos: Record<string, number>) {
  const dev = Object.entries(saldos).filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const cred = Object.entries(saldos).filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const out: { de: string; para: string; centavos: number }[] = [];
  while (dev.length && cred.length) {
    dev.sort((a, b) => b.v - a.v || a.id.localeCompare(b.id));
    cred.sort((a, b) => b.v - a.v || a.id.localeCompare(b.id));
    const d = dev[0]!, c = cred[0]!;
    const x = Math.min(d.v, c.v);
    out.push({ de: d.id, para: c.id, centavos: x });
    d.v -= x; c.v -= x;
    if (!d.v) dev.shift();
    if (!c.v) cred.shift();
  }
  return out;
}

/** Quantas dívidas existiriam sem simplificar: cada parte deve a cada pagador (proporcional), líquido por par. */
export function dividasCruzadas(despesas: DespesaSaldo[], acertos: AcertoSaldo[] = []) {
  const par: Record<string, number> = {};
  const add = (de: string, para: string, c: number) => {
    if (de === para || !c) return;
    const [a, b, s] = de < para ? [de, para, 1] : [para, de, -1];
    par[`${a}|${b}`] = (par[`${a}|${b}`] ?? 0) + s * c;
  };
  for (const d of despesas) {
    if (d.pessoal) continue;
    const tot = d.pagadores.reduce((s, p) => s + centavos(p.valor_moeda_base), 0);
    if (!tot) continue;
    for (const sh of d.partes) for (const p of d.pagadores) add(sh.person_id, p.person_id, Math.round(centavos(sh.valor_moeda_base) * centavos(p.valor_moeda_base) / tot));
  }
  for (const a of acertos) add(a.para_person_id, a.de_person_id, centavos(a.valor_moeda_base));
  return Object.values(par).filter((v) => Math.abs(v) > 0).length;
}

/** De onde vem o saldo de uma pessoa (centavos). */
export function origemSaldo(pid: string, despesas: (DespesaSaldo & { id: string })[], acertos: (AcertoSaldo & { id: string })[]) {
  const divid = despesas.filter((d) => !d.pessoal);
  const pagou = divid.flatMap((d) => d.pagadores.filter((p) => p.person_id === pid).map((p) => ({ id: d.id, c: centavos(p.valor_moeda_base) })));
  const parte = divid.flatMap((d) => d.partes.filter((p) => p.person_id === pid).map((p) => ({ id: d.id, c: centavos(p.valor_moeda_base) })));
  const meus = acertos.filter((a) => a.de_person_id === pid || a.para_person_id === pid);
  const acertosC = meus.reduce((s, a) => s + (a.de_person_id === pid ? 1 : -1) * centavos(a.valor_moeda_base), 0);
  const pagouC = pagou.reduce((s, x) => s + x.c, 0);
  const parteC = parte.reduce((s, x) => s + x.c, 0);
  return { pagou, parte, acertos: meus, pagouC, parteC, acertosC, saldoC: pagouC - parteC + acertosC };
}
