import { useNavigate } from "@tanstack/react-router";
import { Receipt } from "lucide-react";

export function VirarDespesa({ tripId, tipo, itemId, expenseId, descricao, valor, moeda, data }: { tripId: string; tipo: "ticket" | "lodging" | "reservation"; itemId: string; expenseId?: string | null; descricao: string; valor?: number | null; moeda?: string | null; data: string }) {
  const navigate = useNavigate();
  return <button onClick={() => expenseId ? navigate({ to: "/trip/$id/despesas", params: { id: tripId } }) : navigate({ to: "/trip/$id/despesas/nova", params: { id: tripId }, search: { itemTipo: tipo, itemId, descricao, valor: valor == null ? "" : String(valor), moeda: moeda ?? "", data } })} className="tap flex items-center justify-center gap-2 text-lg font-bold text-foreground"><Receipt size={24} strokeWidth={2.2} /> {expenseId ? "Ver despesa" : "Virar despesa"}</button>;
}
