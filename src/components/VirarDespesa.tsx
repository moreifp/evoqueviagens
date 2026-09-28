import { useNavigate } from "@tanstack/react-router";
import { Receipt } from "lucide-react";

const CAT = { ticket: "transporte", lodging: "hospedagem", reservation: "passeio" } as const;
const ORIGEM = { ticket: "Voo", lodging: "Hotel", reservation: "Reserva" } as const;

export function VirarDespesa({ tripId, tipo, itemId, expenseId, descricao, valor, moeda, data, pessoas = [], className }: { tripId: string; tipo: "ticket" | "lodging" | "reservation"; itemId: string; expenseId?: string | null; descricao: string; valor?: number | null; moeda?: string | null; data: string; pessoas?: string[]; className?: string }) {
  const navigate = useNavigate();
  return <button onClick={() => expenseId
    ? navigate({ to: "/trip/$id/despesas/$eid", params: { id: tripId, eid: expenseId } })
    : navigate({ to: "/trip/$id/despesas/nova", params: { id: tripId }, search: { editar: "", itemTipo: tipo, itemId, descricao, valor: valor == null ? "" : String(valor), moeda: moeda ?? "", data, categoria: CAT[tipo], pessoas: [...new Set(pessoas)].join(","), origemNome: `${ORIGEM[tipo]} ${descricao}`.trim() } })}
    className={className ?? "tap flex items-center justify-center gap-2 text-lg font-bold text-foreground"}><Receipt size={24} strokeWidth={2.2} /> {expenseId ? "Ver despesa" : "Virar despesa"}</button>;
}
