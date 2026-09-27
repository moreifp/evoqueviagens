import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { buscarCotacaoDetalhe } from "./data";

afterEach(() => vi.unstubAllGlobals());

describe("cotação histórica", () => {
  it("data passada pede a taxa daquele dia", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ date: "2024-03-15", rates: { BRL: 5.43 } })));
    vi.stubGlobal("fetch", f);
    const c = await buscarCotacaoDetalhe("EUR", "BRL", "2024-03-15");
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain("/v1/2024-03-15?");
    expect(c).toEqual({ taxa: 5.43, fonte: "Frankfurter", data: "2024-03-15" });
  });
  it("data futura usa a mais recente", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ date: "2026-09-25", rates: { BRL: 6 } })));
    vi.stubGlobal("fetch", f);
    await buscarCotacaoDetalhe("EUR", "BRL", "2099-01-01");
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain("/v1/latest?");
  });
});
