/**
 * Logos pelo Logo.dev. Enquanto não houver chave pública (VITE_LOGO_DEV_TOKEN, vinda da conexão Logo.dev),
 * `urlLogo` devolve null e o app mostra o ícone padrão.
 */
export const DOMINIO_CIA: Record<string, string> = {
  TP: "flytap.com", LA: "latamairlines.com", JJ: "latamairlines.com", G3: "voegol.com.br", AD: "voeazul.com.br",
  AF: "airfrance.com", KL: "klm.com", LH: "lufthansa.com", BA: "britishairways.com", IB: "iberia.com",
  UX: "aireuropa.com", EK: "emirates.com", QR: "qatarairways.com", TK: "turkishairlines.com", AA: "aa.com",
  UA: "united.com", DL: "delta.com", CM: "copaair.com", AV: "avianca.com", AR: "aerolineas.com.ar",
  LX: "swiss.com", OS: "austrian.com", SN: "brusselsairlines.com", AZ: "ita-airways.com", EY: "etihad.com",
  AC: "aircanada.com", AM: "aeromexico.com", H2: "skyairline.com", FR: "ryanair.com", U2: "easyjet.com",
  VY: "vueling.com", W6: "wizzair.com", SK: "flysas.com", AY: "finnair.com", EI: "aerlingus.com",
  ET: "ethiopianairlines.com", SA: "flysaa.com", NH: "ana.co.jp", JL: "jal.com", SQ: "singaporeair.com",
  CX: "cathaypacific.com", QF: "qantas.com", LO: "lot.com", A3: "aegeanair.com", S4: "azoresairlines.pt",
};

const NOMES_CIA: Record<string, string> = { tap: "TP", latam: "LA", gol: "G3", azul: "AD", "air france": "AF", klm: "KL", lufthansa: "LH", iberia: "IB", emirates: "EK", "qatar": "QR", turkish: "TK", american: "AA", united: "UA", delta: "DL", copa: "CM", avianca: "AV" };

export function codigoCia(companhia: string | null, numero?: string | null) {
  const n = numero?.trim().toUpperCase().match(/^([A-Z0-9]{2})\s?\d/)?.[1];
  if (n && DOMINIO_CIA[n]) return n;
  const c = companhia?.trim() ?? "";
  if (DOMINIO_CIA[c.toUpperCase()]) return c.toUpperCase();
  const k = Object.keys(NOMES_CIA).find((x) => c.toLowerCase().includes(x));
  return k ? NOMES_CIA[k] : null;
}

export function dominioDoSite(site: string | null | undefined) {
  if (!site) return null;
  try {
    return new URL(site.startsWith("http") ? site : `https://${site}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function urlLogo(dominio: string | null | undefined, tamanho = 64) {
  const token = (import.meta.env["VITE_LOVABLE_CONNECTOR_LOGO_DEV_API_KEY"] ??
    import.meta.env["VITE_LOGO_DEV_TOKEN"]) as string | undefined;
  if (!dominio || !token) return null;
  return `https://img.logo.dev/${dominio}?token=${token}&size=${tamanho}&format=png&retina=true`;
}

export const logoCia = (companhia: string | null, numero?: string | null) => {
  const c = codigoCia(companhia, numero);
  return urlLogo(c ? DOMINIO_CIA[c] : null);
};
export const logoSite = (site: string | null | undefined) => urlLogo(dominioDoSite(site));
