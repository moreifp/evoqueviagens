import { Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { BLOCOS_INFO, type Bloco } from "@/lib/blocos";
import { supabase } from "@/integrations/supabase/client";

function Marca({ on }: { on: boolean }) {
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 ${
        on ? "border-accent bg-accent text-accent-foreground" : "border-border"
      }`}
    >
      {on && <Check size={22} strokeWidth={2.2} />}
    </span>
  );
}

/** tripIds: null = todas (inclui futuras); lista = só essas. */
export function EscolherBlocos({
  valor,
  onChange,
  tripIds,
  onTrips,
}: {
  valor: Bloco[];
  onChange: (v: Bloco[]) => void;
  tripIds?: string[] | null;
  onTrips?: (v: string[] | null) => void;
}) {
  const viagensOn = valor.includes("viagens");
  const { data: minhas } = useQuery({
    queryKey: ["minhas-viagens-compartilhar"],
    enabled: !!onTrips && viagensOn,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("trip")
        .select("id, nome, data_inicio")
        .eq("owner_id", u.user?.id ?? "")
        .is("deleted_at", null)
        .order("data_inicio", { ascending: false });
      return data ?? [];
    },
  });
  const todas = tripIds == null;
  const sel = tripIds ?? [];

  return (
    <div className="space-y-2">
      {BLOCOS_INFO.map((b) => {
        const on = valor.includes(b.id);
        return (
          <div key={b.id} className="space-y-2">
            <button
              type="button"
              role="switch"
              aria-checked={on}
              onClick={() => onChange(on ? valor.filter((x) => x !== b.id) : [...valor, b.id])}
              className={`tap flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left ${
                on ? "border-accent bg-card" : "border-border bg-background"
              }`}
            >
              <Marca on={on} />
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold text-foreground">{b.nome}</span>
                <span className="block text-base text-muted-foreground">{b.desc}</span>
              </span>
            </button>
            {b.id === "viagens" && on && onTrips && (
              <div className="space-y-2 pl-6">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={todas}
                  onClick={() => onTrips(todas ? [] : null)}
                  className="tap flex w-full items-center gap-3 rounded-xl border-2 border-border bg-card p-3 text-left"
                >
                  <Marca on={todas} />
                  <span className="text-lg font-bold text-foreground">Todas (inclui as próximas)</span>
                </button>
                {(minhas ?? []).map((t) => {
                  const m = todas || sel.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="checkbox"
                      aria-checked={m}
                      disabled={todas}
                      onClick={() => onTrips(m ? sel.filter((x) => x !== t.id) : [...sel, t.id])}
                      className="tap flex w-full items-center gap-3 rounded-xl border-2 border-border bg-card p-3 text-left disabled:opacity-60"
                    >
                      <Marca on={m} />
                      <span className="text-lg text-foreground">{t.nome}</span>
                    </button>
                  );
                })}
                {minhas && !minhas.length && <p className="text-base text-muted-foreground">Você ainda não tem viagens.</p>}
                {!todas && !sel.length && <p className="text-base text-muted-foreground">Nenhuma viagem marcada: nada de viagem será mostrado.</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
