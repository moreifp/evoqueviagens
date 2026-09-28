import { CloudCheck, CloudDownload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { baixarTudo, useSeloOffline } from "@/lib/offline";

/** Selo sempre visível no topo da viagem: verde se está no aparelho, âmbar com "Baixar agora" se não. */
export function SeloOffline({ tripId }: { tripId: string }) {
  const selo = useSeloOffline(tripId);
  const qc = useQueryClient();
  const Icone = selo.ok ? CloudCheck : CloudDownload;
  const baixando = selo.texto === "Baixando…";
  if (selo.ok || baixando) {
    return (
      <p role="status" className={`flex items-center gap-2 text-base font-semibold ${selo.ok ? "text-ok" : "text-muted-foreground"}`}>
        <Icone size={22} strokeWidth={2.2} className="shrink-0" />
        {selo.texto}
      </p>
    );
  }
  return (
    <button type="button" onClick={() => void baixarTudo(qc, true, tripId)} className="tap flex min-h-12 items-center gap-2 rounded-xl bg-warn-soft px-3 text-base font-semibold text-warn">
      <Icone size={22} strokeWidth={2.2} className="shrink-0" />
      Não salva · Baixar agora
    </button>
  );
}
