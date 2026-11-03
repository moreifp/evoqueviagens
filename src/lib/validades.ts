import { TIPOS_VISTO } from "./cadastro-tipos";
import { nomeDoc, type EuDocumento } from "./eu";

export type TomValidade = "danger" | "warn" | "ok" | "muted";
export type ItemValidade = {
  doc: EuDocumento;
  nome: string;
  tom: TomValidade;
  dataTexto: string;
  prazo: string;
  resumo: string;
  progresso: number;
  venceEmDias: number | null;
};

const DIA = 86_400_000;
const ORDEM: Record<TomValidade, number> = { danger: 0, warn: 1, muted: 2, ok: 3 };
const visto = (tipo: string) => (TIPOS_VISTO as readonly string[]).includes(tipo);
const dataUTC = (iso: string) => {
  const [ano = 0, mes = 1, dia = 1] = iso.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
};
const inicioHoje = (hoje: Date) => Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());

export function mesesRestantes(validade: string, hoje = new Date()) {
  const fim = dataUTC(validade);
  let meses = (fim.getUTCFullYear() - hoje.getUTCFullYear()) * 12 + fim.getUTCMonth() - hoje.getUTCMonth();
  if (fim.getUTCDate() < hoje.getUTCDate()) meses -= 1;
  return meses;
}

export function diasRestantes(validade: string, hoje = new Date()) {
  return Math.ceil((dataUTC(validade).getTime() - inicioHoje(hoje)) / DIA);
}

function dataBR(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(dataUTC(iso));
}

export function mesAno(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" }).format(dataUTC(iso)).replace(" de ", "/").replace(".", "");
}

function prazoHumano(dias: number, tipo: string) {
  if (tipo === "vacina") return "vitalícia";
  if (dias < 0) return "vencido";
  if (dias <= 45) return dias === 0 ? "vence hoje" : `${dias} ${dias === 1 ? "dia" : "dias"}`;
  const meses = Math.max(1, Math.round(dias / 30.44));
  if (meses < 18) return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  const anos = Math.max(1, Math.round(meses / 12));
  return `${anos} ${anos === 1 ? "ano" : "anos"}`;
}

function nomeDoDoc(doc: EuDocumento) {
  if (doc.tipo === "visto" && doc.detalhe?.trim()) return `Visto EUA · ${doc.detalhe.trim()}`;
  if (doc.tipo === "vacina") return "Febre amarela";
  return nomeDoc(doc);
}

function ePassaporteAntigo(doc: EuDocumento) {
  return doc.tipo === "passaporte" && /substitu[ií]d|passaporte antigo|marcado como vencido/i.test(doc.detalhe ?? "");
}

export function documentosAtivos(documentos: EuDocumento[]) {
  return documentos.filter((doc) => !ePassaporteAntigo(doc));
}

export function classificarDocumento(doc: EuDocumento, hoje = new Date()): ItemValidade {
  const nome = nomeDoDoc(doc);
  if (doc.tipo === "vacina") return { doc, nome, tom: "ok", dataTexto: "proteção vitalícia", prazo: "vitalícia", resumo: "ok", progresso: 100, venceEmDias: null };
  if (!doc.validade) return { doc, nome, tom: "muted", dataTexto: "sem validade cadastrada", prazo: "sem data", resumo: "sem validade cadastrada", progresso: 0, venceEmDias: null };

  const dias = diasRestantes(doc.validade, hoje);
  const meses = mesesRestantes(doc.validade, hoje);
  let tom: TomValidade = "ok";
  if (dias < 0) tom = "danger";
  else if (doc.tipo === "passaporte") tom = meses <= 6 ? "danger" : meses <= 9 ? "warn" : "ok";
  else if (visto(doc.tipo)) tom = /passaporte substitu[ií]d|passaporte novo/i.test(doc.detalhe ?? "") ? "danger" : meses <= 6 ? "warn" : "ok";
  else if (doc.tipo === "cnh" || doc.tipo === "pid") tom = dias <= 90 ? "warn" : "ok";
  else if (doc.tipo === "seguro") tom = dias <= 30 ? "warn" : "ok";
  else if (doc.tipo === "global_entry") tom = meses <= 6 ? "warn" : "ok";

  const total = doc.emissao ? Math.max(1, diasRestantes(doc.validade, dataUTC(doc.emissao))) : 3650;
  const progresso = Math.max(3, Math.min(100, Math.round((Math.max(0, dias) / total) * 100)));
  const prazo = prazoHumano(dias, doc.tipo);
  return {
    doc, nome, tom, prazo, progresso, venceEmDias: dias,
    dataTexto: `${tom === "warn" || tom === "danger" ? "vence em" : "vale até"} ${dataBR(doc.validade)}`,
    resumo: tom === "danger" && dias < 0 ? "vencido" : prazo,
  };
}

export function resumirValidades(documentos: EuDocumento[], hoje = new Date()) {
  const itens = documentosAtivos(documentos).map((doc) => classificarDocumento(doc, hoje)).sort((a, b) =>
    ORDEM[a.tom] - ORDEM[b.tom] || (a.doc.validade ?? "9999").localeCompare(b.doc.validade ?? "9999") || a.nome.localeCompare(b.nome),
  );
  const alertas = itens.filter((item) => item.tom === "danger" || item.tom === "warn");
  const proximo = itens.filter((item) => item.doc.validade && item.venceEmDias != null && item.venceEmDias >= 0).sort((a, b) => (a.venceEmDias ?? Infinity) - (b.venceEmDias ?? Infinity))[0] ?? null;
  const tom: TomValidade = itens.some((i) => i.tom === "danger") ? "danger" : itens.some((i) => i.tom === "warn") ? "warn" : "ok";
  return { itens, alertas, proximo, tom };
}