import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { horaNoFuso } from "@/lib/format";
import { useConexao } from "@/lib/outbox";
import { atualizarStatusVoo } from "@/lib/voo.functions";
import { chipDoStatus, codigoCompanhia, numeroVoo, type StatusVoo as S } from "@/lib/voo";
import type { Ticket } from "@/lib/data";

const TOM = { ok: "bg-ok text-ok-foreground", warn: "bg-warn text-warn-foreground", danger: "bg-danger text-danger-foreground", muted: "bg-muted text-foreground" } as const;

export function linkGoogleVoo(b: Pick<Ticket, "companhia" | "numero">) {
  const q = numeroVoo(b.companhia, b.numero) ?? `${codigoCompanhia(b.companhia) ?? b.companhia ?? ""}${b.numero ?? ""}`.replace(/\s+/g, "");
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

export function StatusVoo({ b, s }: { b: Ticket; s: S | undefined }) {
  const qc = useQueryClient(); const atualizar = useServerFn(atualizarStatusVoo); const { online } = useConexao();
  const [busy, setBusy] = useState(false);
  if (b.tipo !== "voo") return null;
  const chip = s ? chipDoStatus(s) : null;
  const revista = s?.partida_real_utc ?? s?.partida_revista_utc;
  const mudou = revista && s?.partida_prevista_utc && Math.abs(Date.parse(revista) - Date.parse(s.partida_prevista_utc)) >= 5 * 60_000;

  async function go() {
    setBusy(true);
    try {
      const r = await atualizar({ data: { ticket_id: b.id } });
      await qc.invalidateQueries({ queryKey: ["flight_status", b.trip_id] });
      if (r.aviso) toast(r.aviso); else if (r.daCache) toast("Consultado há menos de 10 min · mostrando o último status.");
    } catch { toast.error("Não consegui atualizar agora."); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3 border-t border-border p-4">
      {chip && <div>
        <span className={`inline-flex min-h-14 items-center rounded-2xl px-5 text-xl font-bold ${TOM[chip.tom]}`}>{chip.texto}</span>
        {s?.portao_partida && chip.texto !== `Portão ${s.portao_partida}` && <span className="ml-2 text-lg font-bold">Portão {s.portao_partida}</span>}
        {mudou && revista && <p className="mt-2 text-lg"><strong className="num text-2xl">{horaNoFuso(revista, b.partida_tz)}</strong> <s className="text-muted-foreground">{horaNoFuso(s!.partida_prevista_utc!, b.partida_tz)}</s></p>}
        {s?.esteira && <p className="text-base font-semibold">Esteira {s.esteira}</p>}
        <p className="mt-1 text-base text-muted-foreground">atualizado às {new Date(s!.consultado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · AeroDataBox</p>
      </div>}
      <div className="grid grid-cols-2 gap-2">
        <a href={linkGoogleVoo(b)} target="_blank" rel="noreferrer" className="tap flex items-center justify-center gap-2 rounded-xl border-2 border-border text-lg font-bold"><ExternalLink size={24} strokeWidth={2.2} /> Ver status</a>
        <button type="button" disabled={!online || busy} onClick={() => void go()} className="tap flex items-center justify-center gap-2 rounded-xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-50"><RefreshCw size={24} strokeWidth={2.2} className={busy ? "animate-spin" : ""} /> {busy ? "Atualizando…" : online ? "Atualizar agora" : "Sem internet"}</button>
      </div>
    </div>
  );
}
