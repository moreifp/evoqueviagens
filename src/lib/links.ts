import { cancelarLink } from "./links.functions";
import { criarConvite } from "./compartilhar.functions";

export function urlDoLink(token: string, _secao?: string) {
  return `${window.location.origin}/convite/${token}`;
}

/** Convite estável do pré-cadastro: a pessoa cria a conta, assume a ficha e escolhe o que compartilhar. */
export async function linkDaPessoa(personId: string, _forcarNovo = false): Promise<string> {
  const r = await criarConvite({
    data: { direcao: "pedido", personId, blocos: ["basico", "documentos", "fidelidade", "preferencias", "dependentes", "viagens"] },
  });
  return r.token;
}

export async function cancelarLinkDaPessoa(personId: string) {
  await cancelarLink({ data: { personId } });
}

export function soDigitos(t: string) {
  return t.replace(/\D/g, "");
}

export function telefoneWa(t: string) {
  const d = soDigitos(t);
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}

export function abrirWhatsApp(telefone: string | null, texto: string) {
  const url = telefone
    ? `https://api.whatsapp.com/send?phone=${telefoneWa(telefone)}&text=${encodeURIComponent(texto)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
  window.open(url, "_blank", "noopener");
}

export function mensagemConvite(idioma: "pt" | "en", nome: string, link: string) {
  return idioma === "en"
    ? `Hi ${nome}! Could you fill in your travel profile? It's essential for organizing our trips. It takes 5 minutes and you only do it once. Have your passport at hand. ${link}`
    : `Oi, ${nome}! Preenche seu cadastro de viagem? Ele é extremamente necessário para a organização das nossas viagens. Leva 5 minutos e será só uma vez. Tenha em mãos seu passaporte. ${link}`;
}

export function mensagemLembrete(idioma: "pt" | "en", nome: string, link: string) {
  return idioma === "en"
    ? `Hi ${nome}! Just a reminder to finish your travel profile — it's essential for organizing our trips. It takes 5 minutes; have your passport at hand. Same link: ${link}`
    : `Oi, ${nome}! Só lembrando de terminar seu cadastro de viagem — ele é extremamente necessário para a organização das nossas viagens. Leva 5 minutos; tenha em mãos seu passaporte. É o mesmo link: ${link}`;
}
