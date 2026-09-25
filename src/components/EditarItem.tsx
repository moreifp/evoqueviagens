import { useState } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { mutar } from "@/lib/outbox";

export type Campo = { chave: string; rotulo: string; tipo?: "text" | "number" };
type Linha = { id: string } & Record<string, unknown>;

/**
 * Editar e apagar (soft delete + Desfazer 10 s) de bilhete, hotel ou despesa.
 * Tudo passa pela fila offline e aparece na tela na hora, com ou sem internet.
 */
export function EditarItem({
  tabela,
  item,
  queryKey,
  campos,
  ajustar,
}: {
  tabela: "ticket" | "lodging" | "expense";
  item: Linha;
  queryKey: QueryKey;
  campos: Campo[];
  ajustar?: (valores: Record<string, unknown>, item: Linha) => Record<string, unknown>;
}) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  function aplicarNaTela(f: (lista: Linha[]) => Linha[]) {
    void qc.cancelQueries({ queryKey });
    qc.setQueryData<Linha[]>(queryKey, (lista) => (lista ? f(lista) : lista));
  }
  const aviso = (r: "salvo" | "fila", ok: string) => (r === "fila" ? "Sem internet · salvo no aparelho" : ok);

  function abrir() {
    setForm(Object.fromEntries(campos.map((c) => [c.chave, item[c.chave] == null ? "" : String(item[c.chave])])));
    setAberto(true);
  }

  async function salvar() {
    // Só envia o que mudou.
    let valores: Record<string, unknown> = {};
    for (const c of campos) {
      const antes = item[c.chave] == null ? "" : String(item[c.chave]);
      const agora = (form[c.chave] ?? "").trim();
      if (agora === antes) continue;
      valores[c.chave] = agora === "" ? null : c.tipo === "number" ? Number(agora.replace(",", ".")) : agora;
    }
    if (Object.keys(valores).length === 0) return setAberto(false);
    if (ajustar) valores = ajustar(valores, item);
    aplicarNaTela((l) => l.map((x) => (x.id === item.id ? { ...x, ...valores } : x)));
    setAberto(false);
    try {
      const r = await mutar({ tipo: "update", tabela, id: item.id, valores });
      toast.success(aviso(r, "Salvo"));
    } catch (e) {
      aplicarNaTela((l) => l.map((x) => (x.id === item.id ? item : x)));
      toast.error((e as Error).message || "Não deu para salvar.");
    }
  }

  async function apagar() {
    const agora = new Date().toISOString();
    aplicarNaTela((l) => l.filter((x) => x.id !== item.id));
    try {
      const r = await mutar({ tipo: "update", tabela, id: item.id, valores: { deleted_at: agora } });
      toast(aviso(r, "Apagado"), {
        duration: 10_000,
        action: {
          label: "Desfazer",
          onClick: () => {
            aplicarNaTela((l) => [...l, item]);
            void mutar({ tipo: "update", tabela, id: item.id, valores: { deleted_at: null } });
          },
        },
      });
    } catch (e) {
      aplicarNaTela((l) => [...l, item]);
      toast.error((e as Error).message || "Não deu para apagar.");
    }
  }

  if (!aberto) {
    return (
      <div className="grid grid-cols-2 border-t border-border">
        <button onClick={abrir} className="tap flex items-center justify-center gap-2 text-lg font-bold text-foreground">
          <Pencil size={24} strokeWidth={2.2} /> Editar
        </button>
        <button onClick={apagar} className="tap flex items-center justify-center gap-2 border-l border-border text-lg font-bold text-destructive">
          <Trash2 size={24} strokeWidth={2.2} /> Apagar
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-3 border-t border-border p-4">
      {campos.map((c) => (
        <label key={c.chave} className="block">
          <span className="block text-base font-bold text-muted-foreground">{c.rotulo}</span>
          <input
            value={form[c.chave] ?? ""}
            inputMode={c.tipo === "number" ? "decimal" : undefined}
            onChange={(e) => setForm((f) => ({ ...f, [c.chave]: e.target.value }))}
            className="tap mt-1 w-full rounded-xl border-2 border-border bg-background px-4 text-lg text-foreground"
          />
        </label>
      ))}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={salvar} className="tap flex items-center justify-center gap-2 rounded-xl bg-primary text-lg font-bold text-primary-foreground">
          <Check size={24} strokeWidth={2.2} /> Salvar
        </button>
        <button onClick={() => setAberto(false)} className="tap flex items-center justify-center gap-2 rounded-xl border-2 border-border text-lg font-bold text-foreground">
          <X size={24} strokeWidth={2.2} /> Cancelar
        </button>
      </div>
    </div>
  );
}
