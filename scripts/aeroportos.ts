// @ts-nocheck
/**
 * Gera public/data/aeroportos.json a partir do OurAirports (domínio público).
 * Só aeroportos com código IATA e voo regular (scheduled_service = yes).
 * Fuso IANA calculado pela coordenada com geo-tz (dados timezone-boundary-builder, ODbL/domínio público).
 *
 * Uso (fora do app): bun add geo-tz papaparse && curl -o airports.csv \
 *   https://davidmegginson.github.io/ourairports-data/airports.csv && bun scripts/aeroportos.ts airports.csv out.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import Papa from "papaparse";
import { find } from "geo-tz";

const [, , entrada = "airports.csv", saida = "public/data/aeroportos.json"] = process.argv;
const { data } = Papa.parse(readFileSync(entrada, "utf8"), { header: true, skipEmptyLines: true });
const linhas = [];
for (const a of data) {
  const iata = (a.iata_code || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(iata) || a.scheduled_service !== "yes") continue;
  if (!["large_airport", "medium_airport", "small_airport"].includes(a.type)) continue;
  const lat = Number(a.latitude_deg);
  const lng = Number(a.longitude_deg);
  const tz = find(lat, lng)[0];
  if (!tz) continue;
  // [iata, nome, cidade, país ISO, lat, lng, fuso]
  linhas.push([iata, a.name, a.municipality || "", a.iso_country, +lat.toFixed(4), +lng.toFixed(4), tz]);
}
linhas.sort((x, y) => x[0].localeCompare(y[0]));
const unicos = linhas.filter((l, i) => i === 0 || l[0] !== linhas[i - 1][0]);
writeFileSync(saida, JSON.stringify(unicos));
console.log(unicos.length, "aeroportos");
