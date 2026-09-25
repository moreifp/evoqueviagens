import { Link } from "@tanstack/react-router";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { mutar } from "@/lib/outbox";
import { aviso, naTela } from "@/lib/itens";
import type { ItemRoteiro } from "@/lib/data";

/** Editar (formulário completo) · Apagar com Desfazer 10 s. Tudo pela fila offline. */
export function AcoesItem({
  tabela,
  id,
  tripId,
  editarPara,
  queryKey,
}: {
  tabela: "ticket" | "lodging" | "reservation";
  id: string;
  tripId: string;
  editarPara: "/trip/$id/bilhetes/novo" | "/trip/$id/hospedagem/nova" | "/trip/$id/reservas/nova";
  queryKey: QueryKey;
}) {
  const qc = useQueryClient();

  async function apagar() {
    const lista = qc.getQueryData<{ id: string }[]>(queryKey) ?? [];
    const roteiro = qc.getQueryData<ItemRoteiro[]>(["roteiro", tripId]) ?? [];
    const item = lista.find((x) => x.id === id);
    const itemR = roteiro.find((x) => x.item_id === id);
    const restaurar = () => {
      if (item) naTela<{ id: string }>(qc, queryKey, (l) => [...l.filter((x) => x.id !== id), item]);
      if (itemR) naTela<ItemRoteiro>(qc, ["roteiro", tripId], (l) => [...l.filter((x) => x.item_id !== id), itemR].sort((a, b) => a.inicio_utc.localeCompare(b.inicio_utc)));
    };
    naTela<{ id: string }>(qc, queryKey, (l) => l.filter((x) => x.id !== id));
    naTela<ItemRoteiro>(qc, ["roteiro", tripId], (l) => l.filter((x) => x.item_id !== id));
    try {
      const r = await mutar({ tipo: "update", tabela, id, valores: { deleted_at: new Date().toISOString() } });
      toast(aviso(r, "Apagado"), {
        duration: 10_000,
        action: {
          label: "Desfazer",
          onClick: () => {
            restaurar();
            void mutar({ tipo: "update", tabela, id, valores: { deleted_at: null } }).then((x) => toast.success(aviso(x, "Voltou")));
          },
        },
      });
    } catch (e) {
      restaurar();
      toast.error((e as Error).message || "Não deu para apagar.");
    }
  }

  return (
    <div className="grid grid-cols-2 border-t border-border">
      <Link
        to={editarPara}
        params={{ id: tripId }}
        search={{ editar: id } as never}
        className="tap flex items-center justify-center gap-2 text-lg font-bold text-foreground"
      >
        <Pencil size={24} strokeWidth={2.2} /> Editar
      </Link>
      <button onClick={apagar} className="tap flex items-center justify-center gap-2 border-l border-border text-lg font-bold text-destructive">
        <Trash2 size={24} strokeWidth={2.2} /> Apagar
      </button>
    </div>
  );
}
