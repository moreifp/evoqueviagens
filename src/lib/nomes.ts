/** Conferência de nome bilhete × documento. Mesma regra da função public.nivel_nome no banco. */
const PARTICULAS = new Set(["DE", "DA", "DO", "DOS", "DAS", "E"]);
const TITULOS = new Set(["MR", "MRS", "MS", "MISS", "MSTR", "CHD", "INF"]);
/** Sufixos de geração: não contam como sobrenome. */
const SUFIXOS = new Set(["FILHO", "FILHA", "NETO", "NETA", "SOBRINHO", "SOBRINHA", "JUNIOR", "JR", "SEGUNDO", "TERCEIRO", "II", "III", "IV"]);

/** Sufixo de geração no fim do nome, se houver (ex.: "FILHO"). */
export function sufixoNome(s: string): string | null {
  const t = tokensNome(s);
  const u = t[t.length - 1];
  return u && SUFIXOS.has(u) ? u : null;
}

/** Tokens sem o sufixo de geração final. */
function semSufixo(t: string[]): string[] {
  return t.length > 1 && SUFIXOS.has(t[t.length - 1]!) ? t.slice(0, -1) : t;
}

export type NivelNome = "ok" | "conferir" | "resolver";

export function tokensNome(s: string): string[] {
  let t = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  // "HELITO/MARINA" = SOBRENOME/NOME
  if (t.includes("/")) {
    const [a = "", b = ""] = t.split("/");
    t = `${b} ${a}`;
  }
  t = t.replace(/['`´’]/g, "").replace(/[^A-Z ]/g, " ");
  const res: string[] = [];
  let i = 0;
  for (const x of t.split(/\s+/)) {
    if (!x || PARTICULAS.has(x)) continue;
    i++;
    if (i > 1 && TITULOS.has(x)) continue;
    res.push(x);
  }
  return res;
}

/** ok: 1º nome e último sobrenome iguais e nomes do bilhete na ordem do documento (meio pode faltar ou virar inicial). Sufixos de geração (FILHO, NETO, JR…) não contam como sobrenome. */
export function compararNomes(doc: string, bilhete: string): NivelNome {
  const sd = sufixoNome(doc);
  const sb = sufixoNome(bilhete);
  const d = semSufixo(tokensNome(doc));
  const b = semSufixo(tokensNome(bilhete));
  if (!d.length || !b.length) return "conferir";
  // Sufixos diferentes dos dois lados (FILHO × NETO) → âmbar.
  if (sd && sb && sd !== sb) return "conferir";
  if (b[0] !== d[0]) {
    const trocado = b.includes(d[0]!) && b.some((x) => d.slice(1).includes(x));
    return trocado ? "conferir" : "resolver";
  }
  if (b[b.length - 1] !== d[d.length - 1]) return "conferir";
  let j = 0;
  for (const x of b) {
    while (j < d.length && !(d[j] === x || (x.length === 1 && d[j]!.startsWith(x)))) j++;
    if (j >= d.length) return "conferir";
    j++;
  }
  return "ok";
}
