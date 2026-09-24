import { cancelarLink, linkEstavel } from "./links.functions";

export function urlDoLink(token: string, secao?: string) {
  const base = `${window.location.origin}/c/${token}`;
  return secao ? `${base}?secao=${secao}` : base;
}

/** Link estável da pessoa: o mesmo em qualquer aparelho; reenviar só estende a validade (30 dias). */
export async function linkDaPessoa(personId: string, _forcarNovo = false): Promise<string> {
  const r = await linkEstavel({ data: { personId } });
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
    ? `https://wa.me/${telefoneWa(telefone)}?text=${encodeURIComponent(texto)}`
    : `https://wa.me/?text=${encodeURIComponent(texto)}`;
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
