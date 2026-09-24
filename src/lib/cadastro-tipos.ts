export type Secao = "voce" | "passaporte" | "extras" | "vistos" | "fidelidade" | "preferencias" | "emergencia";

export const SECOES: Secao[] = ["voce", "passaporte", "extras", "vistos", "fidelidade", "preferencias", "emergencia"];

export const NOME_SECAO: Record<Secao, { pt: string; en: string }> = {
  voce: { pt: "Você", en: "You" },
  passaporte: { pt: "Passaporte", en: "Passport" },
  extras: { pt: "Outros documentos", en: "Other documents" },
  vistos: { pt: "Vistos", en: "Visas" },
  fidelidade: { pt: "Fidelidade", en: "Loyalty" },
  preferencias: { pt: "Preferências", en: "Preferences" },
  emergencia: { pt: "Emergência", en: "Emergency" },
};

export function passosDoModo(modo: "rapido" | "completo" | null | undefined): Secao[] {
  return modo === "completo"
    ? ["voce", "passaporte", "extras", "vistos", "fidelidade", "preferencias", "emergencia"]
    : ["voce", "passaporte", "vistos", "fidelidade", "preferencias", "emergencia"];
}

export const TIPOS_VISTO = ["visto", "esta", "eta_canada", "eta_uk", "etias", "k_eta", "outro_visto"] as const;
export const TIPOS_EXTRA = ["rg", "cnh", "pid", "vacina", "seguro", "global_entry"] as const;

export const NOME_DOC: Record<string, string> = {
  passaporte: "Passaporte",
  visto: "Visto EUA",
  esta: "ESTA · EUA",
  eta_canada: "eTA · Canadá",
  eta_uk: "ETA · Reino Unido",
  etias: "ETIAS · Europa",
  k_eta: "K-ETA · Coreia",
  outro_visto: "Outro visto",
  rg: "RG",
  cnh: "CNH",
  pid: "Permissão Internacional (PID)",
  vacina: "Vacina (febre amarela)",
  outra_vacina: "Outra vacina",
  seguro: "Seguro-viagem",
  global_entry: "Global Entry / TSA",
};

export const NOME_DOC_EN: Record<string, string> = {
  passaporte: "Passport",
  visto: "US Visa",
  esta: "ESTA · USA",
  eta_canada: "eTA · Canada",
  eta_uk: "ETA · United Kingdom",
  etias: "ETIAS · Europe",
  k_eta: "K-ETA · Korea",
  outro_visto: "Other visa",
  rg: "ID card (RG)",
  cnh: "Driver's license",
  pid: "International Driving Permit",
  vacina: "Vaccine (yellow fever)",
  outra_vacina: "Other vaccine",
  seguro: "Travel insurance",
  global_entry: "Global Entry / TSA",
};

/** Tipos da seção "Outros documentos" (inclui as vacinas avulsas, que podem ser várias). */
export const TIPOS_SECAO_EXTRAS = [...TIPOS_EXTRA, "outra_vacina"] as const;

export const SALAS_VIP = ["Priority Pass", "LoungeKey", "Pelo cartão"] as const;

export const REFEICOES: { v: string; pt: string; en: string }[] = [
  { v: "nenhuma", pt: "Nenhuma", en: "None" },
  { v: "vegetariana", pt: "Vegetariana", en: "Vegetarian" },
  { v: "sem_gluten", pt: "Sem glúten", en: "Gluten-free" },
  { v: "kosher", pt: "Kosher", en: "Kosher" },
  { v: "halal", pt: "Halal", en: "Halal" },
  { v: "outra", pt: "Outra", en: "Other" },
];
export function nomeRefeicao(v: string | null | undefined, L: "pt" | "en" = "pt") {
  if (!v) return null;
  const r = REFEICOES.find((x) => x.v === v);
  return r ? r[L] : v;
}

export const PROGRAMAS: { nome: string; tipo: "aerea" | "hotel" | "sala_vip" }[] = [
  { nome: "LATAM Pass", tipo: "aerea" },
  { nome: "Smiles", tipo: "aerea" },
  { nome: "TudoAzul", tipo: "aerea" },
  { nome: "TAP Miles&Go", tipo: "aerea" },
  { nome: "Flying Blue", tipo: "aerea" },
  { nome: "AAdvantage", tipo: "aerea" },
  { nome: "Marriott Bonvoy", tipo: "hotel" },
  { nome: "Hilton Honors", tipo: "hotel" },
  { nome: "Accor ALL", tipo: "hotel" },
  { nome: "Priority Pass", tipo: "sala_vip" },
  { nome: "LoungeKey", tipo: "sala_vip" },
  { nome: "Pelo cartão", tipo: "sala_vip" },
];

export type DocDTO = {
  id?: string;
  tipo: string;
  numero?: string | null;
  pais_emissor?: string | null;
  validade?: string | null;
  emissao?: string | null;
  nome_no_documento?: string | null;
  sexo?: string | null;
  detalhe?: string | null;
  arquivo_path?: string | null;
};

export type ContaDTO = { id?: string; programa: string; numero: string | null; tipo: string; categoria?: string | null };

export type CadastroDTO = {
  person: {
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
  };
  docs: DocDTO[];
  contas: ContaDTO[];
  prefs: { assento: string | null; quarto: string | null; bebe_alcool: boolean | null; restricoes: string[]; refeicao_voo: string | null } | null;
  revisoes: { secao: string; status: string; recado: string | null }[];
  fotos: Record<string, string>; // path -> signed url
};
