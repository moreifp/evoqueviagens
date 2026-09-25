/** Tabela de aeroportos embarcada no app (OurAirports, domínio público). Funciona sem internet (pré-cache). */
export type Aeroporto = { iata: string; nome: string; cidade: string; pais: string; lat: number; lng: number; tz: string };

let cache: Aeroporto[] | null = null;
let carregando: Promise<Aeroporto[]> | null = null;

export function carregarAeroportos(): Promise<Aeroporto[]> {
  if (cache) return Promise.resolve(cache);
  if (!carregando) {
    carregando = fetch("/data/aeroportos.json")
      .then((r) => r.json() as Promise<[string, string, string, string, number, number, string][]>)
      .then((linhas) => {
        cache = linhas.map(([iata, nome, cidade, pais, lat, lng, tz]) => ({ iata, nome, cidade, pais, lat, lng, tz }));
        return cache;
      })
      .catch(() => {
        carregando = null;
        return [];
      });
  }
  return carregando;
}

export function porIata(lista: Aeroporto[], iata: string) {
  const c = iata.trim().toUpperCase();
  return lista.find((a) => a.iata === c) ?? null;
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function buscarAeroportos(lista: Aeroporto[], q: string, max = 6) {
  const t = semAcento(q.trim());
  if (t.length < 2) return [];
  const exato = lista.filter((a) => a.iata.toLowerCase() === t);
  const resto = lista.filter(
    (a) => a.iata.toLowerCase() !== t && (a.iata.toLowerCase().startsWith(t) || semAcento(a.cidade).includes(t) || semAcento(a.nome).includes(t)),
  );
  return [...exato, ...resto].slice(0, max);
}
