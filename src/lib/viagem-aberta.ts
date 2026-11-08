/**
 * Viagem em que a pessoa está dentro do app (última tela /trip/<id> aberta nesta sessão).
 * As abas de baixo Fotos e Restaurantes usam isso: foto tirada "dentro" de uma viagem
 * vai para ela; sem viagem aberta, vale a viagem de hoje (a que está acontecendo).
 * sessionStorage: zera quando o app é fechado e aberto de novo.
 */
const CHAVE = "evoque-viagem-aberta";

export function lembrarViagemAberta(id: string) {
  try {
    sessionStorage.setItem(CHAVE, id);
  } catch {
    /* sem sessionStorage */
  }
}

export function viagemAberta(): string | null {
  try {
    return sessionStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}
