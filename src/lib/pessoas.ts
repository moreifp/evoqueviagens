import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NOME_DOC, NOME_SECAO, type Secao, passosDoModo } from "./cadastro-tipos";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any };

export type PessoaRow = {
  id: string;
  nome: string;
  apelido: string | null;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  foto_url: string | null;
  sexo: string | null;
  data_nascimento: string | null;
  nacionalidades: string[];
  nome_como_no_documento: string | null;
  endereco: string | null;
  emergencia_nome: string | null;
  emergencia_parentesco: string | null;
  emergencia_telefone: string | null;
  visto_negado: boolean | null;
  visto_negado_detalhe: string | null;
  status: string;
  passo_atual: number;
  modo: "rapido" | "completo" | null;
  idioma: "pt" | "en";
  consentimento_em: string | null;
  atualizado_em: string;
};

export type DocRow = {
  id: string;
  person_id: string;
  tipo: string;
  numero: string | null;
  pais_emissor: string | null;
  validade: string | null;
  emissao: string | null;
  nome_no_documento: string | null;
  sexo: string | null;
  detalhe: string | null;
  arquivo_path: string | null;
  aguardando_em?: string | null;
};
export const AGUARDANDO = "Aguardando resposta no WhatsApp";
export type ContaRow = { id: string; person_id: string; programa: string; numero: string | null; tipo: string; categoria: string | null };
export type PrefRow = { person_id: string; assento: string | null; quarto: string | null; bebe_alcool: boolean | null; restricoes: string[]; refeicao_voo: string | null };
export type RevisaoRow = { id: string; person_id: string; secao: Secao; status: string; recado: string | null };
export type MudancaRow = {
  id: string;
  person_id: string;
  secao: Secao;
  campo: string;
  valor_antigo: string | null;
  valor_novo: string | null;
  arquivo_antigo: string | null;
  arquivo_novo: string | null;
  criado_em: string;
  status: string;
};
export type LinkRow = { person_id: string; ultimo_acesso_em: string | null; created_at: string };

async function q<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export type Lista = { pessoas: PessoaRow[]; docs: DocRow[]; mudancas: MudancaRow[]; links: LinkRow[] };

export const pessoasQuery = () =>
  queryOptions({
    queryKey: ["pessoas"],
    networkMode: "offlineFirst",
    queryFn: async (): Promise<Lista> => {
      const [pessoas, docs, mudancas, links] = await Promise.all([
        q<PessoaRow[]>(db.from("person").select("*").is("deleted_at", null).order("nome")),
        q<DocRow[]>(db.from("traveler_document").select("*").is("deleted_at", null)),
        q<MudancaRow[]>(db.from("person_change").select("*").eq("status", "pendente").is("deleted_at", null)),
        q<LinkRow[]>(db.from("cadastro_link").select("person_id, ultimo_acesso_em, created_at").is("revogado_em", null)),
      ]);
      return { pessoas, docs, mudancas, links };
    },
  });

export type Ficha = {
  pessoa: PessoaRow;
  docs: DocRow[];
  contas: ContaRow[];
  prefs: PrefRow | null;
  revisoes: RevisaoRow[];
  mudancas: MudancaRow[];
};

export const fichaQuery = (id: string) =>
  queryOptions({
    queryKey: ["ficha", id],
    networkMode: "offlineFirst",
    queryFn: async (): Promise<Ficha> => {
      const [p, docs, contas, prefs, revisoes, mudancas] = await Promise.all([
        q<PessoaRow[]>(db.from("person").select("*").eq("id", id).limit(1)),
        q<DocRow[]>(db.from("traveler_document").select("*").eq("person_id", id).is("deleted_at", null).order("created_at")),
        q<ContaRow[]>(db.from("loyalty_account").select("*").eq("person_id", id).is("deleted_at", null)),
        q<PrefRow[]>(db.from("person_preferences").select("*").eq("person_id", id).limit(1)),
        q<RevisaoRow[]>(db.from("person_section_review").select("*").eq("person_id", id).is("deleted_at", null)),
        q<MudancaRow[]>(db.from("person_change").select("*").eq("person_id", id).eq("status", "pendente").order("criado_em")),
      ]);
      if (!p[0]) throw new Error("Pessoa não encontrada");
      return { pessoa: p[0], docs, contas, prefs: prefs[0] ?? null, revisoes, mudancas };
    },
  });

// ---------- Alertas (avisam, nunca bloqueiam) ----------

export type Nivel = "ok" | "warn" | "danger" | "muted";

export function mesesAte(data: string, hoje = new Date()): number {
  const d = new Date(`${data}T00:00:00`);
  return (d.getFullYear() - hoje.getFullYear()) * 12 + (d.getMonth() - hoje.getMonth()) - (d.getDate() < hoje.getDate() ? 1 : 0);
}

export function alertaDoc(doc: Pick<DocRow, "tipo" | "validade">, hoje = new Date()): { nivel: Nivel; texto: string } | null {
  if (!doc.validade) return null;
  const venc = new Date(`${doc.validade}T23:59:59`);
  if (venc.getTime() < hoje.getTime()) return { nivel: "danger", texto: "Vencido" };
  const m = mesesAte(doc.validade, hoje);
  if (doc.tipo === "passaporte" && m < 6)
    return { nivel: "warn", texto: m <= 0 ? "Vence em menos de 1 mês" : `Vence em ${m} ${m === 1 ? "mês" : "meses"} · menos de 6` };
  if (m < 12) return { nivel: "warn", texto: m <= 0 ? "Vence em menos de 1 mês" : `Vence em ${m} ${m === 1 ? "mês" : "meses"}` };
  return null;
}

export type Situacao = { nivel: Nivel; texto: string; aprovar: boolean; aviso: boolean; lembrar: boolean };

export function situacao(p: PessoaRow, docs: DocRow[], mudancas: MudancaRow[], links: LinkRow[]): Situacao {
  const meus = docs.filter((d) => d.person_id === p.id);
  const mud = mudancas.filter((m) => m.person_id === p.id);
  const total = passosDoModo(p.modo).length;

  if (mud.length) {
    const sec = mud[0]!.secao;
    return { nivel: "warn", texto: `Atualizou ${NOME_SECAO[sec]?.pt.toLowerCase() ?? "a ficha"} · conferir`, aprovar: true, aviso: false, lembrar: false };
  }
  if (p.status === "enviado") return { nivel: "warn", texto: "Enviou a ficha · conferir", aprovar: true, aviso: false, lembrar: false };
  if (p.status === "convidado") {
    const abriu = links.some((l) => l.person_id === p.id && l.ultimo_acesso_em);
    return { nivel: "muted", texto: abriu ? "Abriu o link · ainda não começou" : "Ainda não abriu o link", aprovar: false, aviso: true, lembrar: true };
  }
  if (p.status === "em_andamento")
    return { nivel: "muted", texto: `Parou no passo ${Math.max(1, p.passo_atual)} de ${total}`, aprovar: false, aviso: true, lembrar: true };
  if (p.status === "correcao" || meus.some((d) => d.aguardando_em))
    return { nivel: "warn", texto: AGUARDANDO, aprovar: true, aviso: true, lembrar: false };

  // aprovado: olhar validades
  let pior: { nivel: Nivel; texto: string } | null = null;
  for (const d of meus) {
    const a = alertaDoc(d);
    if (!a) continue;
    const texto = `${NOME_DOC[d.tipo] ?? d.tipo} ${a.texto === "Vencido" ? "vencido" : a.texto.charAt(0).toLowerCase() + a.texto.slice(1)}`;
    if (!pior || (a.nivel === "danger" && pior.nivel !== "danger")) pior = { nivel: a.nivel, texto };
  }
  if (pior) return { ...pior, aprovar: false, aviso: true, lembrar: false };
  if (!meus.some((d) => d.tipo === "passaporte") || !p.emergencia_nome)
    return { nivel: "muted", texto: "Ficha incompleta", aprovar: false, aviso: true, lembrar: true };
  return { nivel: "ok", texto: "Tudo certo", aprovar: false, aviso: false, lembrar: false };
}

export function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1]![0] : "")).toUpperCase();
}

export function mascarar(n: string | null) {
  if (!n) return "—";
  return `•••• ${n.slice(-4)}`;
}

export async function urlAssinada(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("documentos").createSignedUrl(path, 60);
  return data?.signedUrl ?? null;
}

/** Itens de "Demais dados" ainda vazios (para a ficha do admin). */
export type Faltando = { chave: string; rotulo: string };
export function demaisFaltando(f: Ficha): Faltando[] {
  const tem = (t: string) => f.docs.some((d) => d.tipo === t);
  const falta: Faltando[] = [];
  const doc = (t: string, r: string) => !tem(t) && falta.push({ chave: `doc:${t}`, rotulo: r });
  doc("rg", "RG");
  doc("cnh", "CNH");
  doc("pid", "Permissão Internacional (PID)");
  doc("vacina", "Vacina febre amarela");
  doc("seguro", "Seguro-viagem");
  doc("global_entry", "Global Entry / TSA");
  if (!f.pessoa.endereco) falta.push({ chave: "endereco", rotulo: "Endereço" });
  if (!f.contas.some((c) => (c as { tipo?: string }).tipo === "sala_vip")) falta.push({ chave: "salavip", rotulo: "Sala VIP" });
  if (!f.prefs?.refeicao_voo) falta.push({ chave: "refeicao", rotulo: "Refeição especial no voo" });
  if (f.pessoa.visto_negado == null) falta.push({ chave: "visto_negado", rotulo: "Visto negado ou em processo?" });
  return falta;
}
