import { describe, expect, it } from "vitest";
import { dividir, participantesPadrao, saldosDaViagem, simplificarDividas, type DespesaSaldo } from "./divisao";

const M = (id: string, entrou = "2026-10-01", created = `2026-09-0${id.charCodeAt(0) - 96}`) => ({ person_id: id, status: "aceito", entrou_em: entrou, created_at: created });
const membros = [M("a"), M("b"), M("c"), M("d"), M("e"), { ...M("f", "2026-10-23"), created_at: "2026-09-09" }];

function despesa(data: string, totalBase: number, pagadores: [string, number][], opts: { pessoal?: boolean } = {}): DespesaSaldo {
  const ids = participantesPadrao(membros, data).map((m) => m.person_id);
  const { partes } = dividir(Math.round(totalBase * 100), ids.map((id) => ({ id, peso: 1 })), "igual");
  return {
    pessoal: opts.pessoal,
    pagadores: pagadores.map(([person_id, v]) => ({ person_id, valor_moeda_base: v })),
    partes: opts.pessoal ? [] : [...partes].map(([person_id, c]) => ({ person_id, valor_moeda_base: c / 100 })),
  };
}

describe("dividir", () => {
  it("€ 181,00 ÷ 6 = 4 × 30,17 + 2 × 30,16", () => {
    const r = dividir(18100, ["a", "b", "c", "d", "e", "f"].map((id) => ({ id, peso: 1 })), "igual");
    expect([...r.partes.values()]).toEqual([3017, 3017, 3017, 3017, 3016, 3016]);
    expect(r.extras).toBe(4);
  });
  it("valor precisa fechar", () => {
    expect(dividir(1000, [{ id: "a", peso: 4 }, { id: "b", peso: 5 }], "valor").diferencaC).toBe(100);
  });
  it("cotas e %", () => {
    expect([...dividir(1000, [{ id: "a", peso: 2 }, { id: "b", peso: 1 }], "cotas").partes.values()]).toEqual([667, 333]);
    expect(dividir(1000, [{ id: "a", peso: 60 }, { id: "b", peso: 30 }], "pct").fecha).toBe(false);
  });
});

describe("participantesPadrao", () => {
  it("quem entrou depois fica fora", () => {
    expect(participantesPadrao(membros, "2026-10-22").map((m) => m.person_id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(participantesPadrao(membros, "2026-10-23")).toHaveLength(6);
  });
});

describe("saldosDaViagem + simplificarDividas", () => {
  // 3 moedas, já convertidas para EUR com a taxa congelada do dia.
  const usdParaEur = 0.92, brlParaEur = 0.17;
  const despesas = [
    despesa("2026-10-23", 181, [["a", 181]]), // EUR, 6 pessoas
    despesa("2026-10-22", Math.round(100 * usdParaEur * 100) / 100, [["b", 50 * usdParaEur], ["c", 50 * usdParaEur]]), // USD, 2 pagadores, f fora
    despesa("2026-10-22", 300 * brlParaEur, [["d", 300 * brlParaEur]]), // BRL
    despesa("2026-10-24", 40, [["e", 40]], { pessoal: true }),
  ];

  it("soma dos saldos é zero e pessoal não entra", () => {
    const s = saldosDaViagem(despesas);
    expect(Object.values(s).reduce((a, b) => a + b, 0)).toBe(0);
    // e: só partes das despesas divididas, sem os 40 pessoais
    expect(s.e).toBe(-(3016 + 1840 + 1020));
    // f entrou depois: só a despesa de € 181
    expect(s.f).toBe(-3016);
  });

  it("dois acertos e depois a simplificação zera tudo", () => {
    const acertos = [
      { de_person_id: "f", para_person_id: "a", valor_moeda_base: 30.16 },
      { de_person_id: "e", para_person_id: "a", valor_moeda_base: 10 },
    ];
    const s = saldosDaViagem(despesas, acertos);
    expect(s.f).toBe(0);
    expect(Object.values(s).reduce((a, b) => a + b, 0)).toBe(0);
    const t = simplificarDividas(s);
    const final = { ...s };
    for (const x of t) { final[x.de]! += x.centavos; final[x.para]! -= x.centavos; }
    expect(Object.values(final).every((v) => v === 0)).toBe(true);
    expect(t.length).toBeLessThanOrEqual(Object.keys(s).length - 1);
  });
});
