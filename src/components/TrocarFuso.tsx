import { useState } from "react";
import { todosFusos } from "@/lib/fuso";
import { inputCls } from "@/components/Form";

/** Discreto: só para casos raros em que o fuso do aeroporto não serve. */
export function TrocarFuso({ valor, onChange }: { valor: string; onChange: (tz: string) => void }) {
  const [aberto, setAberto] = useState(false);
  if (!aberto)
    return (
      <p className="mt-1 text-base text-muted-foreground">
        Fuso: <span className="font-semibold">{valor.replace(/_/g, " ")}</span>{" "}
        <button type="button" onClick={() => setAberto(true)} className="min-h-[44px] font-bold text-accent underline">
          trocar fuso
        </button>
      </p>
    );
  return (
    <select value={valor} onChange={(e) => onChange(e.target.value)} className={`${inputCls} mt-2`}>
      {todosFusos().map((t) => (
        <option key={t} value={t}>
          {t.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}
