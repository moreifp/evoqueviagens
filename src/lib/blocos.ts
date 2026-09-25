export const BLOCOS_INFO = [
  { id: "basico", nome: "Cadastro básico", desc: "Nome, nascimento, contato, endereço e emergência" },
  { id: "documentos", nome: "Documentos", desc: "Passaporte, vistos, RG, vacinas e fotos" },
  { id: "fidelidade", nome: "Fidelidade", desc: "Programas de milhas, hotéis e salas VIP" },
  { id: "preferencias", nome: "Preferências", desc: "Assento, quarto, refeição e restrições" },
  { id: "dependentes", nome: "Dependentes", desc: "As mesmas informações da sua família" },
  { id: "viagens", nome: "Viagens", desc: "Passagens, hotéis e gastos das suas viagens" },
] as const;

export type Bloco = (typeof BLOCOS_INFO)[number]["id"];
export const TODOS_BLOCOS: Bloco[] = BLOCOS_INFO.map((b) => b.id);
export const nomeBloco = (id: string) => BLOCOS_INFO.find((b) => b.id === id)?.nome ?? id;
