import { UtensilsCrossed, Car, BedDouble, Ticket, ShoppingBag, Ellipsis } from "lucide-react";

export const CATEGORIAS = [
  { id: "comida", rotulo: "Comida", Icone: UtensilsCrossed },
  { id: "transporte", rotulo: "Transporte", Icone: Car },
  { id: "hospedagem", rotulo: "Hospedagem", Icone: BedDouble },
  { id: "passeio", rotulo: "Passeio", Icone: Ticket },
  { id: "compras", rotulo: "Compras", Icone: ShoppingBag },
  { id: "outros", rotulo: "Outros", Icone: Ellipsis },
] as const;

export type CategoriaId = (typeof CATEGORIAS)[number]["id"];

/** Aceita os nomes antigos (alimentacao, mercado, atracoes) que a leitura por IA ainda pode devolver. */
export function normalizarCategoria(c: string | null | undefined): CategoriaId | null {
  const m: Record<string, CategoriaId> = { alimentacao: "comida", mercado: "comida", atracoes: "passeio" };
  const x = (c ?? "").toLowerCase();
  if (CATEGORIAS.some((k) => k.id === x)) return x as CategoriaId;
  return m[x] ?? null;
}

export const categoria = (id: string) => CATEGORIAS.find((c) => c.id === id) ?? CATEGORIAS[5];
