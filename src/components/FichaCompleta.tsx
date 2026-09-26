import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, CircleDashed, MinusCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GRUPOS_FICHA, type ItemFicha } from "@/lib/eu";

/** Lista agrupada de todos os itens da ficha, cada linha abre o formulário do item. */
export function FichaCompleta({ personId, itens, owner }: { personId: string; itens: ItemFicha[]; owner: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [verDispensados, setVerDispensados] = useState(false);

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

  const dispensados = itens.filter((i) => i.dispensado && !i.done && !i.docs?.length);

  return (
    <section className="space-y-6" aria-label="Itens da ficha">
      {GRUPOS_FICHA.map((g) => {
        const lista = itens.filter((i) => i.grupo === g && !(i.dispensado && !i.done && !i.docs?.length));
        if (!lista.length) return null;
        const ok = lista.filter((i) => i.done).length;
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
                    {i.done ? <CheckCircle2 size={28} className="shrink-0 text-ok" aria-hidden /> : <CircleDashed size={28} className={`shrink-0 ${i.obrigatorio ? "text-danger" : "text-warn"}`} aria-hidden />}
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{i.label}</span>
                      <span className="block text-base text-muted-foreground">{i.done ? "Feito" : i.obrigatorio ? "Falta · obrigatório" : "Falta"}</span>
                    </span>
                    {owner && <ChevronRight size={24} aria-hidden />}
                  </button>
                  {owner && !i.done && !i.obrigatorio && (
                    <button type="button" disabled={ocupado === i.id} onClick={() => void dispensar(i, true)} className="tap mr-2 rounded-xl border-2 border-border px-3 text-base font-bold">
                      {i.grupo === "Pessoal" ? "Pular" : "Não tenho"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {dispensados.length > 0 && (
        <div>
          <button type="button" onClick={() => setVerDispensados((v) => !v)} aria-expanded={verDispensados} className="tap flex min-h-16 w-full items-center gap-3 rounded-lg border-2 border-border bg-card px-4 text-left text-lg">
            <MinusCircle size={28} className="shrink-0 text-muted-foreground" aria-hidden />
            <span className="flex-1 font-bold">Itens que você não tem ({dispensados.length})</span>
            <ChevronDown size={24} className={`transition-transform ${verDispensados ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {verDispensados && (
            <ul className="mt-2 divide-y divide-border overflow-hidden rounded-lg border-2 border-border bg-card">
              {dispensados.map((i) => (
                <li key={i.id} className="flex min-h-16 items-center gap-3 px-4">
                  <span className="min-w-0 flex-1 text-lg"><span className="block font-bold">{i.label}</span><span className="block text-base text-muted-foreground">{i.grupo}</span></span>
                  {owner && <>
                    <button type="button" disabled={ocupado === i.id} onClick={() => void dispensar(i, false)} className="tap rounded-xl border-2 border-border px-3 text-base font-bold">Desfazer</button>
                    <button type="button" onClick={() => { void dispensar(i, false); navigate({ href: i.href }); }} className="tap rounded-xl bg-primary px-3 text-base font-bold text-primary-foreground">Acrescentar</button>
                  </>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
