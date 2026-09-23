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

export const TIPOS_VISTO = ["visto", "esta", "eta_canada", "eta_uk", "etias", "outro_visto"] as const;
export const TIPOS_EXTRA = ["rg", "cnh", "pid", "vacina", "seguro", "global_entry"] as const;

export const NOME_DOC: Record<string, string> = {
  passaporte: "Passaporte",
  visto: "Visto EUA",
  esta: "ESTA · EUA",
  eta_canada: "eTA · Canadá",
  eta_uk: "ETA · Reino Unido",
  etias: "ETIAS · Europa",
  outro_visto: "Outro visto",
  rg: "RG",
  cnh: "CNH",
  pid: "Permissão Internacional (PID)",
  vacina: "Vacina (febre amarela)",
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
  outro_visto: "Other visa",
  rg: "ID card (RG)",
  cnh: "Driver's license",
  pid: "International Driving Permit",
  vacina: "Vaccine (yellow fever)",
  seguro: "Travel insurance",
  global_entry: "Global Entry / TSA",
};

export const PROGRAMAS: { nome: string; tipo: "aerea" | "hotel" }[] = [
  { nome: "LATAM Pass", tipo: "aerea" },
  { nome: "Smiles", tipo: "aerea" },
  { nome: "TudoAzul", tipo: "aerea" },
  { nome: "TAP Miles&Go", tipo: "aerea" },
  { nome: "Flying Blue", tipo: "aerea" },
  { nome: "AAdvantage", tipo: "aerea" },
  { nome: "Marriott Bonvoy", tipo: "hotel" },
  { nome: "Hilton Honors", tipo: "hotel" },
  { nome: "Accor ALL", tipo: "hotel" },
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
    status: string;
    passo_atual: number;
    modo: "rapido" | "completo" | null;
    idioma: "pt" | "en";
    consentimento_em: string | null;
  };
  docs: DocDTO[];
  contas: ContaDTO[];
  prefs: { assento: string | null; quarto: string | null; bebe_alcool: boolean | null; restricoes: string[] } | null;
  revisoes: { secao: string; status: string; recado: string | null }[];
  fotos: Record<string, string>; // path -> signed url
};
