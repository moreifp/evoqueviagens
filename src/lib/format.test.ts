import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/sessao", () => ({ usuarioLocal: async () => ({ data: { user: null } }) }));

import { fmtMoney, fmtMoneyShort, horaNoFuso, dataNoFuso, diaSemana, chaveDia, dataBRCurta, mesAno } from "./format";
import { A3_A2, nomePais3 } from "./paises3";
import { paisPt } from "./eu";

const FUSOS = ["America/Sao_Paulo", "Europe/Lisbon", "Africa/Johannesburg", "America/New_York", "Asia/Tokyo", "UTC"];
const MOEDAS = ["BRL", "ZAR", "EUR", "USD", "GBP", "JPY"];
const ISOS = ["2026-01-01T02:30:00Z", "2026-10-26T23:59:00Z", "2026-03-29T01:00:00Z"];

describe("formatadores em cache = Intl direto", () => {
  it("moeda", () => {
    for (const m of MOEDAS) for (const v of [0, 1.5, 1234.567, -99]) {
      const ref = new Intl.NumberFormat("pt-BR", { style: "currency", currency: m, maximumFractionDigits: 2 }).format(v);
      expect(fmtMoney(v, m)).toBe(ref);
      expect(fmtMoney(v, m)).toBe(ref); // segunda chamada (cache)
      expect(fmtMoneyShort(v, m)).toBe(ref.replace(/\u00a0/g, " "));
    }
  });
  it("hora, data, dia da semana e chave por fuso", () => {
    for (const tz of FUSOS) for (const iso of ISOS) {
      const d = new Date(iso);
      expect(horaNoFuso(iso, tz)).toBe(new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(d));
      expect(dataNoFuso(iso, tz)).toBe(new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: tz }).format(d));
      expect(diaSemana(iso, tz)).toBe(new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: tz }).format(d));
      expect(chaveDia(iso, tz)).toBe(new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: tz }).format(d));
    }
  });
  it("cache separa fusos diferentes", () => {
    expect(chaveDia("2026-01-01T02:30:00Z", "UTC")).toBe("2026-01-01");
    expect(chaveDia("2026-01-01T02:30:00Z", "America/Sao_Paulo")).toBe("2025-12-31");
    expect(horaNoFuso("2026-01-01T02:30:00Z", "Asia/Tokyo")).toBe("11:30");
  });
  it("datas curtas e mês/ano", () => {
    expect(dataBRCurta("2026-10-26")).toBe(new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 9, 26))));
    expect(mesAno("2026-10-01")).toBe("outubro de 2026");
  });
  it("fuso inválido cai no reserva", () => {
    expect(horaNoFuso("2026-01-01T02:30:00Z", "Nada/Nada")).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe("nomes de países", () => {
  const dn = new Intl.DisplayNames(["pt-BR"], { type: "region" });
  it("todos os códigos de 3 letras suportados", () => {
    for (const [a3, a2] of Object.entries(A3_A2)) {
      expect(nomePais3(a3)).toBe(dn.of(a2));
      const esperado = a2 === "US" ? "EUA" : a2 === "GB" ? "Reino Unido" : dn.of(a2);
      expect(paisPt(a3)).toBe(esperado);
      expect(paisPt(a2)).toBe(esperado);
    }
  });
  it("casos fixos", () => {
    expect(paisPt("BR")).toBe("Brasil");
    expect(paisPt("bra")).toBe("Brasil");
    expect(paisPt("USA")).toBe("EUA");
    expect(paisPt("ZA")).toBe("África do Sul");
    expect(paisPt("Terra livre")).toBe("Terra livre");
    expect(paisPt(null)).toBe("");
    expect(nomePais3("BRA<")).toBe("Brasil");
    expect(nomePais3("")).toBe("");
  });
});
