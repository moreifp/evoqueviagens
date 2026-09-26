/** Tipos e utilidades da "Emergência na viagem" (sem rede, seguro para o navegador). */
export type PostoEmergencia = {
  tipo: string;
  cidade: string;
  perto_de?: string | null;
  telefone?: string | null;
  plantao?: string | null;
  endereco?: string | null;
  site?: string | null;
  email?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type PaisEmergencia = {
  iso2: string;
  pais: string;
  sem_dados?: boolean;
  geral?: string | null;
  policia?: string | null;
  ambulancia?: string | null;
  bombeiros?: string | null;
  obs?: string | null;
  cobertura_sem_posto?: string | null;
  fonte_url?: string | null;
  postos: PostoEmergencia[];
  outros: PostoEmergencia[];
};

export type Emergencia = {
  conferido_em: string;
  verificado_em: string | null;
  paises: PaisEmergencia[];
  itamaraty: string;
};

export const ITAMARATY = "+55 61 98260-0610";

/** Só dígitos e +, para links tel:. */
export function tel(n: string) {
  return "tel:" + n.replace(/[^\d+]/g, "");
}

/** Número principal: o geral; se não houver, o da polícia. */
export function numeroPrincipal(p: PaisEmergencia) {
  return p.geral ?? p.policia ?? p.ambulancia ?? null;
}

export function dataBRLonga(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function cidadesDosConsulados(e: Emergencia) {
  return [...new Set(e.paises.flatMap((p) => p.postos.map((x) => x.cidade)))];
}
