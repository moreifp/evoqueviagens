/** Conferência determinística da CNH (nº de registro e datas). */
export function validaRegistroCNH(entrada: string): boolean {
  const n = entrada.replace(/\D/g, "");
  if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false;
  let s = 0, dsc = 0;
  for (let i = 0, p = 9; i < 9; i++, p--) s += +n[i]! * p;
  let d1 = s % 11; if (d1 >= 10) { d1 = 0; dsc = 2; }
  s = 0;
  for (let i = 0, p = 1; i < 9; i++, p++) s += +n[i]! * p;
  const x = s % 11; let d2 = x >= 10 ? 0 : x - dsc; if (d2 < 0) d2 += 11; if (d2 >= 10) d2 = 0;
  return `${d1}${d2}` === n.slice(-2);
}

/** Escolhe o nº de registro: o lido, se válido; senão o único válido da lista (sem o CPF). */
export function escolherRegistro(lido: string | null, candidatos: string[], cpf?: string | null): string | null {
  const c = (cpf ?? "").replace(/\D/g, "");
  const limpo = (lido ?? "").replace(/\D/g, "");
  if (limpo && limpo !== c && validaRegistroCNH(limpo)) return limpo;
  const validos = [...new Set(candidatos.map((x) => x.replace(/\D/g, "")))].filter((x) => x !== c && validaRegistroCNH(x));
  return validos.length === 1 ? validos[0]! : null;
}

const dia = (iso: string) => new Date(`${iso}T12:00:00Z`).getTime();
function idade(nasc: string, em: string) {
  const a = new Date(`${nasc}T12:00:00Z`), b = new Date(`${em}T12:00:00Z`);
  let i = b.getUTCFullYear() - a.getUTCFullYear();
  if (b.getUTCMonth() < a.getUTCMonth() || (b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() < a.getUTCDate())) i--;
  return i;
}

/** Campos suspeitos (datas ISO AAAA-MM-DD). Só avisa, não bloqueia. */
export function conferirDatasCNH(f: { nascimento?: string; primeira_habilitacao?: string; emissao?: string; validade?: string }): string[] {
  const s = new Set<string>();
  const { nascimento: n, primeira_habilitacao: h, emissao: e, validade: v } = f;
  if (n && h && !(dia(n) < dia(h))) { s.add("nascimento"); s.add("primeira_habilitacao"); }
  if (h && e && !(dia(h) <= dia(e))) { s.add("primeira_habilitacao"); s.add("emissao"); }
  if (e && v && !(dia(e) < dia(v))) { s.add("emissao"); s.add("validade"); }
  if (n && e && v && dia(e) < dia(v)) {
    const i = idade(n, e);
    const anos = i < 50 ? 10 : i < 70 ? 5 : 3;
    const esperado = new Date(`${e}T12:00:00Z`); esperado.setUTCFullYear(esperado.getUTCFullYear() + anos);
    if (Math.abs(dia(v) - esperado.getTime()) > 60 * 86400000) { s.add("emissao"); s.add("validade"); }
  }
  return [...s];
}
