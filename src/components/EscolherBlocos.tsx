import { Check } from "lucide-react";
import { BLOCOS_INFO, type Bloco } from "@/lib/blocos";

export function EscolherBlocos({ valor, onChange }: { valor: Bloco[]; onChange: (v: Bloco[]) => void }) {
  return (
    <div className="space-y-2">
      {BLOCOS_INFO.map((b) => {
        const on = valor.includes(b.id);
        return (
          <button
            key={b.id}
            type="button"
            role="switch"
            aria-checked={on}
            onClick={() => onChange(on ? valor.filter((x) => x !== b.id) : [...valor, b.id])}
            className={`tap flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left ${
              on ? "border-accent bg-card" : "border-border bg-background"
            }`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 ${
                on ? "border-accent bg-accent text-accent-foreground" : "border-border"
              }`}
            >
              {on && <Check size={22} strokeWidth={2.2} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-bold text-foreground">{b.nome}</span>
              <span className="block text-base text-muted-foreground">{b.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
