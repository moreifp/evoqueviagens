import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NOME_DOC, TIPOS_VISTO } from "./cadastro-tipos";

// Queries stay on the signed-in browser client so every result is filtered by RLS.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (table: string) => any };

export type EuPessoa = {
  id: string;
  account_id: string | null;
  parent_person_id: string | null;
  visto_negado?: boolean | null;
  visto_negado_detalhe?: string | null;
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
  detalhe2?: string | null;
  arquivo_path: string | null;
  primeira_habilitacao?: string | null;
  local_expedicao?: string | null;
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
  expira_em: string | null;
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
  dispensas: string[];
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
           ? rows<EuPessoa[]>(db.from("person").select("*").eq("parent_person_id", personId).eq("kind", "dependent").is("deleted_at", null).order("nome"))
          : Promise.resolve([]),
        rows<EuDados["compartilhamentos"]>(db.from("share_grant").select("*").eq("status", "ativo")),
      ]);
  const dispensas = pessoa.account_id === uid
    ? (await rows<{ item: string }[]>(db.from("person_item_dispensa").select("item").eq("person_id", personId).is("deleted_at", null)).catch(() => [])).map((d) => d.item)
    : [];
  const docsDependentes = dependentes.length
    ? await rows<EuDocumento[]>(db.from("traveler_document").select("*").in("person_id", dependentes.map((d) => d.id)).is("deleted_at", null).order("created_at", { ascending: false }))
    : [];
  const documentosDependentes = Object.fromEntries(dependentes.map((d) => [d.id, docsDependentes.filter((doc) => doc.person_id === d.id)]));
  return { pessoa, documentos, anexos, fidelidades, preferencias: prefs[0] ?? null, dependentes, documentosDependentes, uid, compartilhamentos, dispensas };
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

export type GrupoFicha = "Documentos" | "Vistos e entrada" | "Saúde e seguro" | "Fidelidade" | "Pessoal";
export type ItemFicha = { id: string; label: string; grupo: GrupoFicha; done: boolean; dispensado: boolean; obrigatorio: boolean; href: string; docs?: { id: string; label: string; href: string }[]; novo?: { label: string; href: string } };

const ISO3: Record<string, string> = { BRA: "BR", ITA: "IT", USA: "US", PRT: "PT", ESP: "ES", DEU: "DE", FRA: "FR", GBR: "GB", ARG: "AR", CAN: "CA", JPN: "JP", CHE: "CH", URY: "UY", PRY: "PY", CHL: "CL", MEX: "MX", KOR: "KR", AUS: "AU", IRL: "IE", POL: "PL", ISR: "IL", LBN: "LB", NLD: "NL", AUT: "AT", BEL: "BE" };
const APELIDO: Record<string, string> = { US: "EUA", GB: "Reino Unido" };
/** Nome do país em português a partir do pais_emissor (BR, BRA ou nome livre). */
export function paisPt(v: string | null | undefined): string {
  const t = (v ?? "").trim(); if (!t) return "";
  const up = t.toUpperCase(); const c2 = up.length === 3 ? ISO3[up] : up.length === 2 ? up : null;
  if (!c2) return t;
  if (APELIDO[c2]) return APELIDO[c2];
  try { return new Intl.DisplayNames(["pt-BR"], { type: "region" }).of(c2) ?? t; } catch { return t; }
}
export const GRUPOS_FICHA: GrupoFicha[] = ["Documentos", "Vistos e entrada", "Saúde e seguro", "Fidelidade", "Pessoal"];

/** Todos os itens do cadastro pessoal. Obrigatórios: passaporte e emergência; o resto pode ser "Não tenho". */
export function progressoFicha(dados: EuDados) {
  const p = dados.pessoa;
  const tem = (tipos: readonly string[]) => dados.documentos.some((d) => tipos.includes(d.tipo));
  const fid = (tipo: string) => dados.fidelidades.some((f) => f.tipo === tipo);
  const doc = (tipo: string) => `/pessoas/${p.id}/documentos/novo?tipo=${tipo}`;
  const dispensas = new Set(dados.dispensas ?? []);
  const base: Omit<ItemFicha, "dispensado" | "obrigatorio">[] = [
    { id: "passaporte", label: "Passaporte", grupo: "Documentos", done: tem(["passaporte"]), href: doc("passaporte") },
    { id: "cpf", label: "CPF", grupo: "Documentos", done: !!p.cpf, href: `/pessoas/${p.id}/dados` },
    { id: "rg", label: "RG", grupo: "Documentos", done: tem(["rg"]), href: doc("rg") },
    { id: "cnh", label: "CNH", grupo: "Documentos", done: tem(["cnh"]), href: doc("cnh") },
    { id: "pid", label: "Permissão Internacional (PID)", grupo: "Documentos", done: tem(["pid"]), href: doc("pid") },
    { id: "visto", label: "Visto EUA", grupo: "Vistos e entrada", done: tem(["visto"]), href: doc("visto") },
    { id: "esta", label: "ESTA · EUA", grupo: "Vistos e entrada", done: tem(["esta"]), href: doc("esta") },
    { id: "eta_canada", label: "eTA · Canadá", grupo: "Vistos e entrada", done: tem(["eta_canada"]), href: doc("eta_canada") },
    { id: "eta_uk", label: "ETA · Reino Unido", grupo: "Vistos e entrada", done: tem(["eta_uk"]), href: doc("eta_uk") },
    { id: "etias", label: "ETIAS · Europa", grupo: "Vistos e entrada", done: tem(["etias"]), href: doc("etias") },
    { id: "k_eta", label: "K-ETA · Coreia", grupo: "Vistos e entrada", done: tem(["k_eta"]), href: doc("k_eta") },
    { id: "outro_visto", label: "Outro visto", grupo: "Vistos e entrada", done: tem(["outro_visto"]), href: doc("outro_visto") },
    { id: "visto_negado", label: "Visto negado ou em processo", grupo: "Vistos e entrada", done: p.visto_negado != null, href: `/pessoas/${p.id}/dados?secao=visto` },
    { id: "global_entry", label: "Global Entry / TSA PreCheck (KTN)", grupo: "Vistos e entrada", done: tem(["global_entry"]), href: doc("global_entry") },
    { id: "vacina", label: "Vacina febre amarela", grupo: "Saúde e seguro", done: tem(["vacina"]), href: doc("vacina") },
    { id: "outra_vacina", label: "Outras vacinas", grupo: "Saúde e seguro", done: tem(["outra_vacina"]), href: doc("outra_vacina") },
    { id: "seguro", label: "Seguro-viagem", grupo: "Saúde e seguro", done: tem(["seguro"]), href: doc("seguro") },
    { id: "fid_aerea", label: "Programas aéreos", grupo: "Fidelidade", done: fid("aerea"), href: `/pessoas/${p.id}/fidelidade/novo?tipo=aerea` },
    { id: "fid_hotel", label: "Hotéis", grupo: "Fidelidade", done: fid("hotel"), href: `/pessoas/${p.id}/fidelidade/novo?tipo=hotel` },
    { id: "fid_locadora", label: "Locadoras", grupo: "Fidelidade", done: fid("locadora"), href: `/pessoas/${p.id}/fidelidade/novo?tipo=locadora` },
    { id: "fid_sala_vip", label: "Sala VIP", grupo: "Fidelidade", done: fid("sala_vip"), href: `/pessoas/${p.id}/fidelidade/novo?tipo=sala_vip` },
    { id: "endereco", label: "Endereço", grupo: "Pessoal", done: !!p.endereco, href: `/pessoas/${p.id}/dados` },
    { id: "emergencia", label: "Contato de emergência", grupo: "Pessoal", done: !!(p.emergencia_nome && p.emergencia_telefone), href: `/pessoas/${p.id}/dados?secao=emergencia` },
    { id: "preferencias", label: "Preferências", grupo: "Pessoal", done: !!dados.preferencias, href: `/pessoas/${p.id}/dados?secao=preferencias` },
  ];
  const OBRIG = new Set(["passaporte", "emergencia"]);
  const REPETE = new Set(["passaporte", "visto", "esta", "eta_canada", "eta_uk", "etias", "k_eta", "outro_visto", "vacina", "outra_vacina", "seguro", "global_entry"]);
  // Item feito abre o documento salvo (não a tela de adicionar).
  const abrir = (i: Omit<ItemFicha, "dispensado" | "obrigatorio">) => {
    if (!i.done || REPETE.has(i.id)) return i.href;
    const d = dados.documentos.find((x) => x.tipo === i.id);
    return d ? `/pessoas/${p.id}/documentos/${d.id}` : i.href;
  };
  const itens: ItemFicha[] = base.map((i) => ({ ...i, href: abrir(i),
    ...(REPETE.has(i.id) && i.done ? {
      docs: dados.documentos.filter((d) => d.tipo === i.id).map((d) => ({ id: d.id, label: `${i.id === "passaporte" ? "Passaporte" : i.id === "visto" ? "Visto" : i.label.split(" · ")[0]}${paisPt(d.pais_emissor) ? ` · ${paisPt(d.pais_emissor)}` : ""}`, href: `/pessoas/${p.id}/documentos/${d.id}` })),
      novo: i.id === "passaporte" ? { label: "+ Novo passaporte", href: doc("passaporte") } : i.id === "visto" ? { label: "+ Novo visto", href: doc("visto") } : undefined,
    } : {}), obrigatorio: OBRIG.has(i.id), dispensado: !i.done && !OBRIG.has(i.id) && dispensas.has(i.id) }));
  const feitos = itens.filter((i) => i.done || i.dispensado).length;
  const total = itens.length;
  return { itens, feitos, total, percentual: Math.round((feitos / total) * 100) };
}

export function mascararFinal(numero: string | null) {
  if (!numero) return "Sem número";
  return `•••• ${numero.replace(/\s/g, "").slice(-4)}`;
}