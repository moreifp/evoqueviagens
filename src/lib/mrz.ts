/**
 * Leitura determinística da zona MRZ (TD3, passaporte: 2 linhas × 44).
 * Sem IA aqui: só texto → campos, com validação de dígitos verificadores.
 */
export type MrzResultado = {
  ok: boolean;
  sobrenome: string;
  nomes: string;
  nomeCompleto: string;
  paisEmissor: string;
  nacionalidade: string;
  numero: string;
  nascimento: string | null; // YYYY-MM-DD
  sexo: "M" | "F" | "X" | null;
  validade: string | null; // YYYY-MM-DD
  checks: { numero: boolean; nascimento: boolean; validade: boolean; final: boolean };
};

const PESOS = [7, 3, 1];

function valorChar(c: string): number {
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - 48;
  if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 55;
  return 0; // '<'
}

export function digitoVerificador(s: string): number {
  let soma = 0;
  for (let i = 0; i < s.length; i++) soma += valorChar(s[i]!) * PESOS[i % 3]!;
  return soma % 10;
}

function confere(campo: string, digito: string | undefined): boolean {
  if (digito === undefined) return false;
  const d = digito === "<" ? 0 : Number(digito);
  return !Number.isNaN(d) && digitoVerificador(campo) === d;
}

function normaliza(l: string): string {
  return l
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[«‹]/g, "<")
    .replace(/[^A-Z0-9<]/g, "<")
    .padEnd(44, "<")
    .slice(0, 44);
}

function data(yymmdd: string, futuro: boolean): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2));
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  const anoAtual = new Date().getFullYear() % 100;
  let seculo: number;
  if (futuro) seculo = 2000; // validades
  else seculo = yy > anoAtual ? 1900 : 2000;
  return `${seculo + yy}-${mm}-${dd}`;
}

function limpaNome(s: string) {
  return s.replace(/<+/g, " ").trim().replace(/\s+/g, " ");
}

export function lerMrz(linha1: string, linha2: string): MrzResultado | null {
  const l1 = normaliza(linha1);
  const l2 = normaliza(linha2);
  if (!l1.startsWith("P")) return null;
  const paisEmissor = l1.slice(2, 5).replace(/</g, "").replace(/0/g, "O");
  const nomesParte = l1.slice(5);
  const [sob = "", ...resto] = nomesParte.split("<<");
  const sobrenome = limpaNome(sob);
  const nomes = limpaNome(resto.join(" "));

  const numeroCampo = l2.slice(0, 9);
  const nac = l2.slice(10, 13).replace(/</g, "").replace(/0/g, "O");
  const nasc = l2.slice(13, 19);
  const sexoC = l2[20];
  const val = l2.slice(21, 27);
  const composto = l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, 43);

  const checks = {
    numero: confere(numeroCampo, l2[9]),
    nascimento: confere(nasc, l2[19]),
    validade: confere(val, l2[27]),
    final: confere(composto, l2[43]),
  };

  const sexo = sexoC === "M" || sexoC === "F" ? sexoC : sexoC === "<" || sexoC === "X" ? "X" : null;

  return {
    ok: checks.numero && checks.nascimento && checks.validade,
    sobrenome,
    nomes,
    nomeCompleto: [nomes, sobrenome].filter(Boolean).join(" "),
    paisEmissor,
    nacionalidade: nac,
    numero: numeroCampo.replace(/</g, ""),
    nascimento: data(nasc, false),
    sexo,
    validade: data(val, true),
    checks,
  };
}

/** Acha as duas linhas MRZ num texto qualquer devolvido pela leitura da foto. */
export function extrairLinhas(texto: string): [string, string] | null {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim().toUpperCase().replace(/\s+/g, ""))
    .filter((l) => l.length >= 30 && /^[A-Z0-9<]+$/.test(l));
  const i = linhas.findIndex((l) => l.startsWith("P"));
  if (i < 0 || !linhas[i + 1]) return null;
  return [linhas[i]!, linhas[i + 1]!];
}
