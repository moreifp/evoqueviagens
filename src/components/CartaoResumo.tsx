import { BedDouble, Car, Map as MapIcon, Plane, Ticket, Utensils, Lock } from "lucide-react";
import type { ItemRoteiro } from "@/lib/data";
import { chaveDia, dataBRCurta, horaNoFuso, fusoLocal } from "@/lib/format";

const ICONES: Record<string, typeof Plane> = { voo: Plane, hotel: BedDouble, carro: Car, passeio: MapIcon, restaurante: Utensils };

/** Item em que a pessoa não está: só título, horário e quem vai. */
export function CartaoResumo({ r }: { r: ItemRoteiro }) {
  const Icone = ICONES[r.subtipo] ?? Ticket;
  const tz = r.item_tipo === "lodging" ? fusoLocal() : r.inicio_tz;
  return (
    <article className="rounded-2xl border-2 border-dashed border-border bg-card p-4">
      <div className="flex items-start gap-4">
        <Icone size={28} strokeWidth={2.2} className="mt-1 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-xl font-bold text-foreground">{r.titulo}</p>
          <p className="text-lg font-semibold text-muted-foreground">
            {dataBRCurta(chaveDia(r.inicio_utc, tz))} · {horaNoFuso(r.inicio_utc, tz)}
            {r.companhia || r.numero ? ` · ${[r.companhia, r.numero].filter(Boolean).join(" ")}` : ""}
          </p>
          {r.pessoas.length > 0 && <p className="mt-1 text-lg text-foreground">Vão: {r.pessoas.map((p) => p.nome).join(", ")}</p>}
          <p className="mt-2 flex items-center gap-2 text-base text-muted-foreground">
            <Lock size={18} strokeWidth={2.2} /> Resumo · você não está neste item
          </p>
        </div>
      </div>
    </article>
  );
}
