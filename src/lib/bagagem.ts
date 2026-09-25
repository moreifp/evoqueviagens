/** Franquia de bagagem de um bilhete/passageiro. */
export type Bagagem = { bag_mao_qtd: number | null; bag_mao_kg: number | null; item_pessoal: boolean | null; bag_desp_qtd: number | null; bag_desp_kg: number | null };
export const CAMPOS_BAGAGEM = ["bag_mao_qtd", "bag_mao_kg", "item_pessoal", "bag_desp_qtd", "bag_desp_kg"] as const;
export const BAGAGEM_VAZIA: Bagagem = { bag_mao_qtd: null, bag_mao_kg: null, item_pessoal: null, bag_desp_qtd: null, bag_desp_kg: null };

export const temBagagem = (b: Partial<Bagagem> | null | undefined) => !!b && CAMPOS_BAGAGEM.some((k) => b[k] != null);

export function pegarBagagem(x: Partial<Bagagem> | null | undefined): Bagagem {
  return { bag_mao_qtd: x?.bag_mao_qtd ?? null, bag_mao_kg: x?.bag_mao_kg ?? null, item_pessoal: x?.item_pessoal ?? null, bag_desp_qtd: x?.bag_desp_qtd ?? null, bag_desp_kg: x?.bag_desp_kg ?? null };
}

const kg = (n: number | null) => (n != null ? ` ${String(n).replace(".", ",")} kg` : "");

/** "1 mão 10 kg · item pessoal · 2 × 23 kg despachadas" */
export function textoBagagem(b: Partial<Bagagem> | null | undefined): string {
  if (!temBagagem(b)) return "";
  const p: string[] = [];
  if (b!.bag_mao_qtd != null) p.push(b!.bag_mao_qtd === 0 ? "sem mão" : `${b!.bag_mao_qtd} mão${kg(b!.bag_mao_kg)}`);
  if (b!.item_pessoal != null) p.push(b!.item_pessoal ? "item pessoal" : "sem item pessoal");
  if (b!.bag_desp_qtd != null) p.push(b!.bag_desp_qtd === 0 ? "sem despachada" : `${b!.bag_desp_qtd} ×${kg(b!.bag_desp_kg) || " mala"} despachada${b!.bag_desp_qtd > 1 ? "s" : ""}`);
  return p.join(" · ");
}

export const mesmaBagagem = (a: Partial<Bagagem>, b: Partial<Bagagem>) => CAMPOS_BAGAGEM.every((k) => (a[k] ?? null) === (b[k] ?? null));
