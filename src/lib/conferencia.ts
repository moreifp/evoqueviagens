/** "Está tudo certo?" por pessoa. Regras puras: avisam, não garantem, nunca bloqueiam. */
import type { Trip } from "./data";

export const SCHENGEN = ["AT","BE","BG","HR","CZ","DK","EE","FI","FR","DE","GR","HU","IS","IT","LV","LI","LT","LU","MT","NL","NO","PL","PT","RO","SK","SI","ES","SE","CH"];

export type RegraPassaporte = { meses: number; base: "saida" | "chegada"; geral: boolean };
export type EntryRule = { nacionalidade: string; pais_destino: string; exigencia: string; detalhe: string | null; validade_passaporte_min_meses: number | null; fonte_url: string; verificado_em: string };

export type Conferencia = {
  member_id: string; person_id: string; nome: string; kind: string; status: string; papel: string; acesso: boolean; meu: boolean;
  nacionalidades: string[]; nome_documento: string | null;
  passaporte: { validade: string | null; nome: string | null; pais: string | null } | null;
  vistos: { tipo: string; validade: string | null }[]; vacina: string | null; seguro: string | null;
  nomes_bilhete: string[]; convite_telefone: string | null; convite_email: string | null; pedido_aberto: boolean; avisos_abertos: number;
};

export type Nivel = "resolver" | "esperando" | "conferir" | "ok";
export type Achado = { nivel: Nivel; texto: string; campo?: "passaporte" | "visto" | "vacina" | "seguro"; aviso?: string };
export type Cartao = { c: Conferencia; nivel: Nivel; titulo: string; achados: Achado[]; semAcesso: boolean; semConta: boolean };

export function regraPassaporte(trip: Pick<Trip, "data_inicio">, paises: string[], ajuste?: { meses?: number; base?: string } | null): RegraPassaporte {
  if (ajuste?.meses && (ajuste.base === "saida" || ajuste.base === "chegada")) return { meses: ajuste.meses, base: ajuste.base, geral: false };
  const soSchengen = paises.length > 0 && paises.every((p) => SCHENGEN.includes(p));
  return soSchengen ? { meses: 3, base: "saida", geral: true } : { meses: 6, base: "chegada", geral: true };
}

export function somarMeses(iso: string, meses: number) {
  const [y = 0, m = 1, d = 1] = iso.split("-").map(Number);
  const alvo = new Date(Date.UTC(y, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}

export const br = (iso: string) => iso.split("-").reverse().join("/");
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z ]/g, "").replace(/\s+/g, " ").trim();
const ORDEM: Record<Nivel, number> = { resolver: 0, esperando: 1, conferir: 2, ok: 3 };

export function conferir(c: Conferencia, trip: Trip, destinoNome: string, paises: string[], regra: RegraPassaporte, regras: EntryRule[], hoje = new Date().toISOString().slice(0, 10)): Cartao {
  const semConta = c.kind === "precadastro";
  if (semConta) return { c, nivel: "esperando", titulo: "Ainda sem conta · convite enviado", achados: [], semAcesso: false, semConta };
  if (!c.acesso) return { c, nivel: "esperando", titulo: c.pedido_aberto ? "Pedido de documentos enviado · esperando" : "Não liberou documentos · não dá para conferir", achados: [], semAcesso: true, semConta };
  const achados: Achado[] = [];
  const primeiro = c.nome.split(" ")[0];
  const limite = somarMeses(regra.base === "saida" ? trip.data_fim : trip.data_inicio, regra.meses);
  const regraTxt = `${regra.meses} meses após a ${regra.base === "saida" ? "saída" : "chegada"}${regra.geral ? " · regra geral · confirme" : " · ajustado por você"}`;
  const pv = c.passaporte?.validade;
  if (!c.passaporte) achados.push({ nivel: "resolver", campo: "passaporte", texto: "Sem passaporte cadastrado", aviso: `Oi, ${primeiro}! Não achei seu passaporte no app. Para ${destinoNome} ele precisa valer até ${br(limite)}. Pode cadastrar?` });
  else if (!pv) achados.push({ nivel: "conferir", campo: "passaporte", texto: "Passaporte sem validade registrada", aviso: `Oi, ${primeiro}! Seu passaporte está sem validade no app. Para ${destinoNome} ele precisa valer até ${br(limite)}. Pode conferir?` });
  else if (pv < limite) achados.push({ nivel: "resolver", campo: "passaporte", texto: `Passaporte vence ${br(pv)} · precisa valer até ${br(limite)} (${regraTxt})`, aviso: `Seu passaporte vence ${br(pv)}. Para ${destinoNome} ele precisa valer até ${br(limite)}. Dá para renovar antes?` });
  else achados.push({ nivel: "ok", texto: `Passaporte vale até ${br(pv)} · limite ${br(limite)} (${regraTxt})` });

  const doc = c.passaporte?.nome || c.nome_documento;
  for (const nb of c.nomes_bilhete) {
    if (!doc) achados.push({ nivel: "conferir", texto: `Bilhete "${nb}" · sem nome do passaporte para comparar` });
    else if (norm(doc) !== norm(nb)) achados.push({ nivel: "conferir", campo: "passaporte", texto: `Nome no bilhete "${nb}" difere do passaporte "${doc}"`, aviso: `Oi, ${primeiro}! O nome no bilhete está "${nb}" e no passaporte "${doc}". Confere para mim?` });
    else achados.push({ nivel: "ok", texto: `Nome no bilhete confere com o passaporte` });
  }

  for (const pais of paises) {
    const regrasP = (c.nacionalidades.length ? c.nacionalidades : ["?"]).map((n) => regras.find((r) => r.nacionalidade === n && r.pais_destino === pais));
    const r = regrasP.find(Boolean);
    if (!r) { achados.push({ nivel: "conferir", texto: `Sem regra cadastrada para ${pais} · confira no consulado` }); continue; }
    const velha = (Date.parse(hoje) - Date.parse(r.verificado_em)) / 864e5 > 180;
    const fonte = `fonte: ${r.fonte_url}`;
    if (r.exigencia === "nenhuma") achados.push({ nivel: velha ? "conferir" : "ok", texto: `${pais}: sem exigência registrada em ${br(r.verificado_em)} · confirme no consulado · ${fonte}${velha ? " · não verificado" : ""}` });
    else {
      const tem = c.vistos.some((v) => !v.validade || v.validade >= trip.data_fim);
      achados.push({ nivel: tem ? (velha ? "conferir" : "ok") : "resolver", campo: "visto", texto: `${pais}: ${r.exigencia} registrado em ${br(r.verificado_em)}${tem ? " · há visto/autorização cadastrado" : " · nenhum cadastrado"} · ${fonte}${velha ? " · não verificado" : ""}`, aviso: tem ? undefined : `Oi, ${primeiro}! Para ${destinoNome} há registro de ${r.exigencia}. Você já tem? Confirme no consulado.` });
    }
  }
  if (c.vacina) achados.push(c.vacina < trip.data_fim && c.vacina >= "1900" ? { nivel: "conferir", campo: "vacina", texto: `Vacina cadastrada vence ${br(c.vacina)}`, aviso: `Oi, ${primeiro}! Sua vacina cadastrada vence ${br(c.vacina)}. Confere?` } : { nivel: "ok", texto: "Vacina cadastrada" });
  if (c.seguro) achados.push(c.seguro < trip.data_fim ? { nivel: "conferir", campo: "seguro", texto: `Seguro-viagem vence ${br(c.seguro)}, antes do fim da viagem`, aviso: `Oi, ${primeiro}! Seu seguro-viagem vence ${br(c.seguro)} e a viagem vai até ${br(trip.data_fim)}. Dá para estender?` } : { nivel: "ok", texto: "Seguro-viagem cobre a viagem" });

  const nivel = achados.reduce<Nivel>((n, a) => (ORDEM[a.nivel] < ORDEM[n] ? a.nivel : n), "ok");
  const titulo = nivel === "ok" ? "Tudo certo" : nivel === "resolver" ? "Resolver" : "Conferir";
  return { c, nivel, titulo, achados, semAcesso: false, semConta };
}

export function ordenar(cs: Cartao[]) {
  return [...cs].sort((a, b) => ORDEM[a.nivel] - ORDEM[b.nivel] || a.c.nome.localeCompare(b.c.nome));
}

export const ATALHOS: Record<"passaporte" | "visto" | "vacina" | "seguro", (nome: string, destino: string) => string> = {
  passaporte: (n, d) => `Oi, ${n}! Pode conferir a validade do seu passaporte para ${d}?`,
  visto: (n, d) => `Oi, ${n}! Pode conferir se precisa de visto ou autorização eletrônica para ${d}? Confirme no consulado.`,
  vacina: (n, d) => `Oi, ${n}! Pode cadastrar sua vacina (febre amarela) para ${d}?`,
  seguro: (n, d) => `Oi, ${n}! Pode cadastrar o seguro-viagem para ${d}?`,
};
