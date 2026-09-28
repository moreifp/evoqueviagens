import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Phone, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buscarEmergencia } from "@/lib/emergencia.functions";
import { cidadesDosConsulados, numeroPrincipal } from "@/lib/emergencia";
import { tripQuery, type Trip } from "@/lib/data";

export function useOnline() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(navigator.onLine);
    const a = () => setOn(true), b = () => setOn(false);
    window.addEventListener("online", a);
    window.addEventListener("offline", b);
    return () => { window.removeEventListener("online", a); window.removeEventListener("offline", b); };
  }, []);
  return on;
}

export function useBuscarEmergencia(tripId: string) {
  const qc = useQueryClient();
  const fn = useServerFn(buscarEmergencia);
  const [buscando, setBuscando] = useState(false);
  async function buscar() {
    setBuscando(true);
    try {
      const snap = await fn({ data: { trip_id: tripId } });
      qc.setQueryData<Trip>(tripQuery(tripId).queryKey, (t) => (t ? { ...t, emergencia: snap } : t));
      return true;
    } catch (e) {
      toast.error((e as Error).message || "Não deu para buscar.");
      return false;
    } finally {
      setBuscando(false);
    }
  }
  return { buscar, buscando };
}

/** Linha-card na tela da viagem. Nenhuma chamada de rede ao aparecer. */
export function CartaoEmergencia({ trip, editavel }: { trip: Trip; editavel: boolean }) {
  const on = useOnline();
  const nav = useNavigate();
  const { buscar, buscando } = useBuscarEmergencia(trip.id);
  const e = trip.emergencia;
  const base = "tap shadow-soft flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left";

  if (e && e.paises.length) {
    const p = e.paises[0]!;
    const n = numeroPrincipal(p);
    const cid = cidadesDosConsulados(e);
    return (
      <Link to="/trip/$id/emergencia" params={{ id: trip.id }} className={base}>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-emerg-soft text-emerg">
          <Phone size={26} strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block text-lg">Emergência{n ? ` · ${n}` : ""}</strong>
          <span className="block text-base text-muted-foreground">{cid.length ? `Consulados em ${cid.join(" e ")} · sem internet` : "Salvo · sem internet"}</span>
        </span>
        <ChevronRight size={24} className="shrink-0 text-muted-foreground" />
      </Link>
    );
  }
  if (!editavel) return null;
  return (
    <button
      type="button"
      disabled={!on || buscando}
      onClick={async () => { if (await buscar()) void nav({ to: "/trip/$id/emergencia", params: { id: trip.id } }); }}
      className={`${base} disabled:opacity-70`}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-emerg-soft text-emerg">
        {buscando ? <Loader2 size={26} className="animate-spin" /> : <Phone size={26} strokeWidth={2.2} />}
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-lg">{buscando ? "Buscando dados de emergência…" : "Dados de emergência · Buscar"}</strong>
        {!on && <span className="block text-base text-muted-foreground">Precisa de internet para buscar</span>}
      </span>
    </button>
  );
}
