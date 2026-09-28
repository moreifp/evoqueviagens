import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Award, CheckCircle2, ChevronDown, ChevronRight, CircleDashed, HeartPulse, IdCard, MinusCircle, Stamp, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GRUPOS_FICHA, type ItemFicha } from "@/lib/eu";

const ICONE_GRUPO: Record<string, { Icone: typeof IdCard; cor: string }> = {
  "Documentos": { Icone: IdCard, cor: "bg-doc-soft text-doc" },
  "Vistos e entrada": { Icone: Stamp, cor: "bg-voos-soft text-voos" },
  "Saúde e seguro": { Icone: HeartPulse, cor: "bg-desp-soft text-desp" },
  "Fidelidade": { Icone: Award, cor: "bg-reserva-soft text-reserva" },
  "Pessoal": { Icone: UserRound, cor: "bg-pess-soft text-pess" },
};

/**
 * Lista agrupada de todos os itens da ficha, cada linha abre o formulário do item.
 * Cada seção é recolhível: o título fica sempre visível; os campos só aparecem quando aberta.
 * Por padrão, abrem as seções com algo pendente; a escolha fica guardada no aparelho.
 */
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
    if (error) { toast.error("Não consegui salvar. Tente de novo."); return; }
    await qc.invalidateQueries({ queryKey: ["eu", personId] });
  }

  const dispensados = itens.filter((i) => i.dispensado && !i.done && !i.docs?.length);

  return (
    <section className="space-y-6" aria-label="Itens da ficha">
      {GRUPOS_FICHA.map((g) => <Grupo key={g} personId={personId} grupo={g} itens={itens} owner={owner} ocupado={ocupado} dispensar={dispensar} navigate={navigate} />)}

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

export function useGrupoAberto(personId: string, grupo: string, temPendente: boolean) {
  const chave = `evoque-ficha-aberta-${personId}-${grupo}`;
  const [aberto, setAberto] = useState(temPendente);
  useEffect(() => {
    const salvo = localStorage.getItem(chave);
    setAberto(salvo === null ? temPendente : salvo === "1");
  }, [chave, temPendente]);
  function alternar() {
    setAberto((atual) => {
      localStorage.setItem(chave, atual ? "0" : "1");
      return !atual;
    });
  }
  return [aberto, alternar] as const;
}

function Grupo({ personId, grupo, itens, owner, ocupado, dispensar, navigate }: {
  personId: string; grupo: string; itens: ItemFicha[]; owner: boolean; ocupado: string | null;
  dispensar: (item: ItemFicha, sim: boolean) => Promise<void>;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const lista = itens.filter((i) => i.grupo === grupo && !(i.dispensado && !i.done && !i.docs?.length));
  const ok = lista.filter((i) => i.done).length;
  const temPendente = ok < lista.length;
  const [aberto, alternar] = useGrupoAberto(personId, grupo, temPendente);
  if (!lista.length) return null;
  const dec = ICONE_GRUPO[grupo];
  return (
    <div>
      <button type="button" onClick={alternar} aria-expanded={aberto} className="tap flex min-h-14 w-full items-center justify-between gap-3 text-left">
        <span className="flex items-center gap-3">
          {dec && (
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${dec.cor}`}><dec.Icone size={20} aria-hidden /></span>
          )}
          <h2 className="text-2xl">{grupo}</h2>
        </span>
        <span className="ml-auto flex items-center gap-2 text-lg font-bold text-muted-foreground">{ok} de {lista.length}<ChevronDown size={26} className={`transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden /></span>
      </button>
      {aberto && <ul className="mt-2 divide-y divide-border overflow-hidden rounded-lg border-2 border-border bg-card">
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
      </ul>}
    </div>
  );
}
