import {
  Bus,
  BedDouble,
  UtensilsCrossed,
  ShoppingCart,
  Ticket,
  ShoppingBag,
  CircleEllipsis,
} from "lucide-react";

export const CATEGORIAS = [
  { id: "transporte", rotulo: "Transporte", Icone: Bus },
  { id: "hospedagem", rotulo: "Hospedagem", Icone: BedDouble },
  { id: "alimentacao", rotulo: "Alimentação", Icone: UtensilsCrossed },
  { id: "mercado", rotulo: "Mercado", Icone: ShoppingCart },
  { id: "atracoes", rotulo: "Atrações", Icone: Ticket },
  { id: "compras", rotulo: "Compras", Icone: ShoppingBag },
  { id: "outros", rotulo: "Outros", Icone: CircleEllipsis },
] as const;
