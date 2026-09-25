import { CloudCheck, CloudDownload } from "lucide-react";
import { useSeloOffline } from "@/lib/offline";

/** Selo discreto no topo da viagem. */
export function SeloOffline({ tripId }: { tripId: string }) {
  const selo = useSeloOffline(tripId);
  if (!selo) return null;
  const Icone = selo.ok ? CloudCheck : CloudDownload;
  return (
    <p role="status" className="flex items-center gap-2 text-base font-semibold text-muted-foreground">
      <Icone size={22} strokeWidth={2.2} className="shrink-0" />
      {selo.texto}
    </p>
  );
}
