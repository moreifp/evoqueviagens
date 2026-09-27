/** Código de país de 3 letras (MRZ / ISO 3166 alfa-3) → nome em português. */
const A3_A2: Record<string, string> = {
  BRA: "BR", ITA: "IT", PRT: "PT", ESP: "ES", FRA: "FR", DEU: "DE", D: "DE", GBR: "GB", IRL: "IE", USA: "US", CAN: "CA", MEX: "MX",
  ARG: "AR", URY: "UY", PRY: "PY", CHL: "CL", BOL: "BO", PER: "PE", COL: "CO", VEN: "VE", ECU: "EC", CHE: "CH", AUT: "AT",
  BEL: "BE", NLD: "NL", LUX: "LU", DNK: "DK", SWE: "SE", NOR: "NO", FIN: "FI", ISL: "IS", POL: "PL", CZE: "CZ", HUN: "HU",
  GRC: "GR", TUR: "TR", ISR: "IL", LBN: "LB", JPN: "JP", CHN: "CN", KOR: "KR", IND: "IN", AUS: "AU", NZL: "NZ", ZAF: "ZA",
  RUS: "RU", UKR: "UA", ROU: "RO", HRV: "HR", SVN: "SI", SVK: "SK", BGR: "BG", SRB: "RS", EGY: "EG", MAR: "MA", AGO: "AO",
  MOZ: "MZ", CPV: "CV", CUB: "CU", DOM: "DO", PAN: "PA", CRI: "CR", GTM: "GT", ARE: "AE", SAU: "SA", QAT: "QA", THA: "TH",
  VNM: "VN", SGP: "SG", MYS: "MY", IDN: "ID", PHL: "PH", TWN: "TW", HKG: "HK", MCO: "MC", MLT: "MT", CYP: "CY", EST: "EE",
  LVA: "LV", LTU: "LT",
};

export function nomePais3(cod: string | null | undefined): string {
  if (!cod) return "";
  const c = cod.toUpperCase().replace(/</g, "");
  const a2 = A3_A2[c] ?? (c.length === 2 ? c : null);
  if (a2) {
    try { return new Intl.DisplayNames(["pt-BR"], { type: "region" }).of(a2) ?? c; } catch { /* sem Intl */ }
  }
  return c;
}
