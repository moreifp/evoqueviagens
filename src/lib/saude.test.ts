import { describe, expect, it } from "vitest";
import { entradaSaudeSchema } from "./saude";

const person_id = "96d11fa6-bb21-4103-82c2-a2b5c46f8b03";
describe("informações de saúde", () => {
  it("aceita nome e dose de remédio sem foto", () => {
    expect(entradaSaudeSchema.safeParse({ person_id, tipo: "remedio", nome: "Insulina", dose: "10 unidades", foto_data: null }).success).toBe(true);
  });
  it("não aceita remédio sem nome", () => {
    expect(entradaSaudeSchema.safeParse({ person_id, tipo: "remedio", nome: "  ", dose: null, foto_data: null }).success).toBe(false);
  });
  it("aceita nome de médico ou condição sem dose", () => {
    for (const tipo of ["medico", "condicao"]) {
      expect(entradaSaudeSchema.safeParse({ person_id, tipo, nome: "Diabetes", dose: null, foto_data: null }).success).toBe(true);
    }
  });
});