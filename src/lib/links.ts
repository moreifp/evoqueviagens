import { supabase } from "@/integrations/supabase/client";

/** O token do link só existe no aparelho de quem convidou; no banco fica apenas o hash. */
const CHAVE = "evoque-links";
type Guardado = { token: string; expira: string };

function mapa(): Record<string, Guardado> {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? "{}");
  } catch {
    return {};
  }
}

function base64url(bytes: Uint8Array) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Hex(t: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function urlDoLink(token: string, secao?: string) {
  const base = `${window.location.origin}/c/${token}`;
  return secao ? `${base}?secao=${secao}` : base;
}

/** Devolve o link válido desta pessoa (o mesmo de antes, se ainda existir neste aparelho). */
export async function linkDaPessoa(personId: string, forcarNovo = false): Promise<string> {
  const m = mapa();
  const g = m[personId];
  if (!forcarNovo && g && new Date(g.expira).getTime() > Date.now() + 3600_000) return g.token;

  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = base64url(bytes);
  const hash = await sha256Hex(token);
  const expira = new Date(Date.now() + 7 * 86400_000).toISOString();
  const { data: u } = await supabase.auth.getUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as unknown as { from: (t: string) => any };
  await db
    .from("cadastro_link")
    .update({ revogado_em: new Date().toISOString() })
    .eq("person_id", personId)
    .is("revogado_em", null);
  const { error } = await db.from("cadastro_link").insert({
    person_id: personId,
    token_hash: hash,
    expira_em: expira,
    criado_por: u.user?.email ?? null,
  });
  if (error) throw new Error(error.message);
  m[personId] = { token, expira };
  localStorage.setItem(CHAVE, JSON.stringify(m));
  return token;
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
