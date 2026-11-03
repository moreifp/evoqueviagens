import { describe, expect, it } from "vitest";
import { ehAVez } from "./voo";

const H = 3_600_000;

/** Simula o job a cada 15 min e conta as consultas de um voo. */
function contar(partida: number, chegada: number) {
  let ultima: number | null = null;
  let n = 0;
  for (let agora = partida - 30 * H; agora <= chegada + H; agora += 15 * 60_000) {
    if (ehAVez(partida, chegada, ultima, agora)) {
      ultima = agora;
      n++;
    }
  }
  return { n, ultima };
}

describe("ehAVez", () => {
  it("voo longo (12 h) continua consultado em voo e após o pouso, com poucas chamadas", () => {
    const partida = Date.UTC(2026, 9, 10, 22);
    const chegada = partida + 12 * H;
    const { n, ultima } = contar(partida, chegada);
    expect(ultima).toBeGreaterThanOrEqual(chegada);
    expect(n).toBeLessThanOrEqual(12);
  });

  it("voo curto (50 min) também tem a consulta após o pouso", () => {
    const partida = Date.UTC(2026, 9, 10, 12);
    const chegada = partida + 50 * 60_000;
    const { n, ultima } = contar(partida, chegada);
    expect(ultima).toBeGreaterThanOrEqual(chegada);
    expect(n).toBeLessThanOrEqual(11);
  });
});
