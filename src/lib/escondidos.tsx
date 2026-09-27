import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { mutar } from "./outbox";

/** Avisos que a pessoa pediu para não mostrar mais. Valem enquanto a "impressão" do dado for a mesma. */
export type Escondido = { chave: string; impressao: string; rotulo: string; contexto: string | null; escondido_em: string };

const KEY = ["avisos-escondidos"] as const;

export const escondidosQuery = () => ({
  queryKey: KEY,
  queryFn: async (): Promise<Escondido[]> => {
    const { data, error } = await supabase.from("aviso_escondido").select("chave, impressao, rotulo, contexto, escondido_em").is("deleted_at", null);
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 60_000,
});

export function useEscondidos() {
  const { data = [] } = useQuery(escondidosQuery());
  const mapa = new Map(data.map((e) => [e.chave, e.impressao]));
  return { lista: data, oculto: (chave: string, impressao: string) => mapa.get(chave) === impressao };
}

async function uid() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export function useEsconder() {
  const qc = useQueryClient();
  async function gravar(e: Omit<Escondido, "escondido_em">, ativo: boolean) {
    const account_id = await uid();
    if (!account_id) return;
    qc.setQueryData<Escondido[]>(KEY, (l = []) => {
      const sem = l.filter((x) => x.chave !== e.chave);
      return ativo ? [...sem, { ...e, escondido_em: new Date().toISOString() }] : sem;
    });
    await mutar({
      tipo: "upsert", tabela: "aviso_escondido", onConflict: "account_id,chave",
      valores: { account_id, chave: e.chave, impressao: e.impressao, rotulo: e.rotulo.slice(0, 300), contexto: e.contexto, escondido_em: new Date().toISOString(), deleted_at: ativo ? null : new Date().toISOString() },
    }).catch((err) => toast.error((err as Error).message));
  }
  return {
    esconder: (e: Omit<Escondido, "escondido_em">) => {
      void gravar(e, true);
      toast("Aviso escondido", { duration: 6000, action: { label: "Desfazer", onClick: () => void gravar(e, false) } });
    },
    mostrar: (e: Escondido) => void gravar(e, false),
  };
}

/** Botão pequeno "Não mostrar mais". Crítico pede um toque de confirmação. */
export function NaoMostrar({ chave, impressao, rotulo, contexto, critico = false, className = "" }: { chave: string; impressao: string; rotulo: string; contexto: string | null; critico?: boolean; className?: string }) {
  const { esconder } = useEsconder();
  const [confirmar, setConfirmar] = useState(false);
  if (confirmar) return (
    <span className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button type="button" onClick={() => esconder({ chave, impressao, rotulo, contexto })} className="min-h-11 rounded-full bg-danger px-3 text-sm font-bold text-danger-foreground">Esconder mesmo assim?</button>
      <button type="button" onClick={() => setConfirmar(false)} className="min-h-11 px-2 text-sm font-semibold text-muted-foreground">Não</button>
    </span>
  );
  return (
    <button type="button" onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); if (critico) setConfirmar(true); else esconder({ chave, impressao, rotulo, contexto }); }}
      className={`inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground ${className}`}>
      <EyeOff size={18} aria-hidden /> Não mostrar mais
    </button>
  );
}

/** Linha discreta no fim da tela: "Avisos escondidos (N) · mostrar". */
export function AvisosEscondidos({ contextos }: { contextos: string[] }) {
  const { lista } = useEscondidos();
  const { mostrar } = useEsconder();
  const [aberto, setAberto] = useState(false);
  const meus = lista.filter((e) => e.contexto && contextos.includes(e.contexto));
  if (!meus.length) return null;
  return (
    <section className="py-3 text-center">
      <button type="button" onClick={() => setAberto((v) => !v)} className="min-h-11 text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline">
        Avisos escondidos ({meus.length}) · {aberto ? "fechar" : "mostrar"}
      </button>
      {aberto && (
        <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-card px-3 text-left">
          {meus.map((e) => (
            <li key={e.chave} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1 text-base text-foreground">{e.rotulo || "Aviso"}</span>
              <button type="button" onClick={() => mostrar(e)} className="min-h-11 shrink-0 text-sm font-bold text-accent">Mostrar de novo</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
