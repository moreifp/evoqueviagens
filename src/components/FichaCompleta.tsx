import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, ChevronRight, CircleDashed, MinusCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GRUPOS_FICHA, type ItemFicha } from "@/lib/eu";

/** Lista agrupada de todos os itens da ficha, cada linha abre o formulário do item. */
export function FichaCompleta({ personId, itens, owner }: { personId: string; itens: ItemFicha[]; owner: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function dispensar(item: ItemFicha, sim: boolean) {
    setOcupado(item.id);
    const db = supabase as unknown as { from: (t: string) => any };
    const { error } = sim
      ? await db.from("person_item_dispensa").insert({ person_id: personId, item: item.id })
      : await db.from("person_item_dispensa").update({ deleted_at: new Date().toISOString() }).eq("person_id", personId).eq("item", item.id).is("deleted_at", null);
    setOcupado(null);
    if (error) return toast.error("Não consegui salvar. Tente de novo.");
    await qc.invalidateQueries({ queryKey: ["eu", personId] });
  }

  return (
    <section className="space-y-6" aria-label="Itens da ficha">
      {GRUPOS_FICHA.map((g) => {
        const lista = itens.filter((i) => i.grupo === g);
        const ok = lista.filter((i) => i.done || i.dispensado).length;
        return (
          <div key={g}>
            <h2 className="mb-2 flex items-baseline justify-between text-2xl">{g}<span className="text-lg font-bold text-muted-foreground">{ok} de {lista.length}</span></h2>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border-2 border-border bg-card">
              {lista.map((i) => i.docs?.length ? (
                <li key={i.id}>
                  {i.docs.map((d) => (
                    <button key={d.id} type="button" onClick={() => navigate({ href: d.href })} className="tap flex min-h-16 w-full items-center gap-3 border-b border-border px-4 text-left text-lg last:border-b-0">
                      <CheckCircle2 size={28} className="shrink-0 text-ok" aria-hidden />
                      <span className="min-w-0 flex-1"><span className="block font-bold">{d.label}</span><span className="block text-base text-muted-foreground">Feito</span></span>
                      <ChevronRight size={24} aria-hidden />
                    </button>
                  ))}
                  {owner && i.novo && <button type="button" onClick={() => navigate({ href: i.novo!.href })} className="tap flex min-h-14 w-full items-center px-4 pl-14 text-left text-lg font-bold text-accent">{i.novo.label}</button>}
                </li>
              ) : (
                <li key={i.id} className="flex items-center">
                  <button type="button" disabled={!owner} onClick={() => navigate({ href: i.href })} className="tap flex min-h-16 flex-1 items-center gap-3 px-4 text-left text-lg">
                    {i.done ? <CheckCircle2 size={28} className="shrink-0 text-ok" aria-hidden /> : i.dispensado ? <MinusCircle size={28} className="shrink-0 text-muted-foreground" aria-hidden /> : <CircleDashed size={28} className={`shrink-0 ${i.obrigatorio ? "text-danger" : "text-warn"}`} aria-hidden />}
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{i.label}</span>
                      <span className="block text-base text-muted-foreground">{i.done ? "Feito" : i.dispensado ? "Não tenho" : i.obrigatorio ? "Falta · obrigatório" : "Falta"}</span>
                    </span>
                    {owner && <ChevronRight size={24} aria-hidden />}
                  </button>
                  {owner && !i.done && !i.obrigatorio && (
                    <button type="button" disabled={ocupado === i.id} onClick={() => void dispensar(i, !i.dispensado)} className="tap mr-2 rounded-xl border-2 border-border px-3 text-base font-bold">
                      {i.dispensado ? "Desfazer" : i.grupo === "Pessoal" ? "Pular" : "Não tenho"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
