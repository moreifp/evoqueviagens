import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NOME_DOC, TIPOS_VISTO } from "./cadastro-tipos";

// Queries stay on the signed-in browser client so every result is filtered by RLS.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (table: string) => any };

export type EuPessoa = {
  id: string;
  account_id: string | null;
  kind: string;
  nome: string;
  apelido: string | null;
  email: string | null;
  telefone: string | null;
  foto_url: string | null;
  cpf: string | null;
  sexo: string | null;
  data_nascimento: string | null;
  nacionalidades: string[];
  nome_como_no_documento: string | null;
  endereco: string | null;
  emergencia_nome: string | null;
  emergencia_parentesco: string | null;
  emergencia_telefone: string | null;
  deleted_at: string | null;
};

export type EuDocumento = {
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
  created_at: string;
};

export type AnexoDocumento = {
  id: string;
  document_id: string;
  person_id: string;
  storage_path: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  is_primary: boolean;
  created_at: string;
};

export type Fidelidade = {
  id: string;
  person_id: string;
  programa: string;
  numero: string | null;
  tipo: string;
  categoria: string | null;
  titular: string | null;
  site_url: string | null;
  cartao_path: string | null;
};

export type Preferencias = {
  person_id: string;
  assento: string | null;
  quarto: string | null;
  bebe_alcool: boolean | null;
  restricoes: string[];
  refeicao_voo: string | null;
};

export type EuDados = {
  pessoa: EuPessoa;
  documentos: EuDocumento[];
  anexos: AnexoDocumento[];
  fidelidades: Fidelidade[];
  preferencias: Preferencias | null;
  dependentes: EuPessoa[];
  documentosDependentes: Record<string, EuDocumento[]>;
  uid: string;
  compartilhamentos: { id: string; owner_id: string; grantee_id: string; owner_nome: string | null; grantee_nome: string | null; blocos: string[]; trip_ids: string[] | null; created_at: string }[];
};

async function rows<T>(request: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export const minhaPessoaQuery = () =>
  queryOptions({
    queryKey: ["minha-pessoa"],
    networkMode: "offlineFirst",
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Entre na sua conta para continuar.");
      const pessoas = await rows<EuPessoa[]>(
        db.from("person").select("*").eq("account_id", auth.user.id).eq("kind", "self").is("deleted_at", null).limit(1),
      );
      if (!pessoas[0]) throw new Error("Sua ficha ainda está sendo preparada.");
      return pessoas[0];
    },
  });

async function loadEu(personId: string): Promise<EuDados> {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? "";
      const pessoas = await rows<EuPessoa[]>(db.from("person").select("*").eq("id", personId).is("deleted_at", null).limit(1));
      const pessoa = pessoas[0];
      if (!pessoa) throw new Error("Pessoa não encontrada.");
      const [documentos, anexos, fidelidades, prefs, dependentes, compartilhamentos] = await Promise.all([
        rows<EuDocumento[]>(db.from("traveler_document").select("*").eq("person_id", personId).is("deleted_at", null).order("created_at", { ascending: false })),
        rows<AnexoDocumento[]>(db.from("document_attachment").select("*").eq("person_id", personId).is("deleted_at", null).order("created_at")),
        rows<Fidelidade[]>(db.from("loyalty_account").select("*").eq("person_id", personId).is("deleted_at", null).order("programa")),
        rows<Preferencias[]>(db.from("person_preferences").select("*").eq("person_id", personId).is("deleted_at", null).limit(1)),
        pessoa.account_id === uid
          ? rows<EuPessoa[]>(db.from("person").select("*").eq("account_id", uid).eq("kind", "dependent").is("deleted_at", null).order("nome"))
          : Promise.resolve([]),
        rows<EuDados["compartilhamentos"]>(db.from("share_grant").select("*").eq("status", "ativo")),
      ]);
  const docsDependentes = dependentes.length
    ? await rows<EuDocumento[]>(db.from("traveler_document").select("*").in("person_id", dependentes.map((d) => d.id)).is("deleted_at", null).order("created_at", { ascending: false }))
    : [];
  const documentosDependentes = Object.fromEntries(dependentes.map((d) => [d.id, docsDependentes.filter((doc) => doc.person_id === d.id)]));
  return { pessoa, documentos, anexos, fidelidades, preferencias: prefs[0] ?? null, dependentes, documentosDependentes, uid, compartilhamentos };
}

export const euQuery = (personId: string) =>
  queryOptions({
    queryKey: ["eu", personId],
    networkMode: "offlineFirst",
    queryFn: () => loadEu(personId),
  });

export const documentoQuery = (personId: string, documentId: string) =>
  queryOptions({
    queryKey: ["documento", personId, documentId],
    networkMode: "offlineFirst",
    queryFn: async () => {
      const dados = await loadEu(personId);
      const documento = dados.documentos.find((item) => item.id === documentId);
      if (!documento) throw new Error("Documento não encontrado.");
      return { ...dados, documento, anexos: dados.anexos.filter((item) => item.document_id === documentId) };
    },
  });

export function nomeDocumento(tipo: string) {
  return NOME_DOC[tipo] ?? (tipo === "outro" ? "Outro documento" : tipo);
}

export function statusDocumento(doc: EuDocumento) {
  if (!doc.validade) return { label: "Sem validade", tone: "muted" as const };
  const fim = new Date(`${doc.validade}T23:59:59`).getTime();
  const meses = Math.floor((fim - Date.now()) / (30.44 * 86400000));
  if (fim < Date.now()) return { label: "Vencido", tone: "danger" as const };
  if (meses <= 6) return { label: "Vencendo", tone: "warn" as const };
  return { label: "Válido", tone: "ok" as const };
}

export function progressoFicha(dados: EuDados) {
  const p = dados.pessoa;
  const tem = (tipos: readonly string[]) => dados.documentos.some((d) => tipos.includes(d.tipo));
  const itens = [
    { label: "Foto", done: !!p.foto_url, href: `/pessoas/${p.id}/dados` },
    { label: "Dados pessoais", done: !!(p.nome && p.data_nascimento && p.sexo && p.nacionalidades.length), href: `/pessoas/${p.id}/dados` },
    { label: "Passaporte", done: tem(["passaporte"]), href: `/pessoas/${p.id}/documentos/novo?tipo=passaporte` },
    { label: "RG", done: tem(["rg"]), href: `/pessoas/${p.id}/documentos/novo?tipo=rg` },
    { label: "CNH", done: tem(["cnh"]), href: `/pessoas/${p.id}/documentos/novo?tipo=cnh` },
    { label: "Visto ou autorização", done: tem(TIPOS_VISTO), href: `/pessoas/${p.id}/documentos/novo?tipo=visto` },
    { label: "Vacina", done: tem(["vacina", "outra_vacina"]), href: `/pessoas/${p.id}/documentos/novo?tipo=vacina` },
    { label: "Fidelidade", done: dados.fidelidades.length > 0, href: `/pessoas/${p.id}/fidelidade` },
    { label: "Preferências", done: !!dados.preferencias, href: `/pessoas/${p.id}/dados?secao=preferencias` },
    { label: "Contato de emergência", done: !!(p.emergencia_nome && p.emergencia_telefone), href: `/pessoas/${p.id}/dados?secao=emergencia` },
  ];
  const feitos = itens.filter((item) => item.done).length;
  return { itens, feitos, percentual: feitos * 10 };
}

export function mascararFinal(numero: string | null) {
  if (!numero) return "Sem número";
  return `•••• ${numero.replace(/\s/g, "").slice(-4)}`;
}