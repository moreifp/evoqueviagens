import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Siren, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buscarEmergencia } from "@/lib/emergencia.functions";
import { cidadesDosConsulados, numeroPrincipal } from "@/lib/emergencia";
import { tripQuery, type Trip } from "@/lib/data";

export function useOnline() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(navigator.onLine);
    const a = () => setOn(true),
      b = () => setOn(false);
    window.addEventListener("online", a);
    window.addEventListener("offline", b);
    return () => {
      window.removeEventListener("online", a);
      window.removeEventListener("offline", b);
    };
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
      qc.setQueryData<Trip>(tripQuery(tripId).queryKey, (t) =>
        t ? { ...t, emergencia: snap } : t,
      );
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

/**
 * Botão vermelho de Emergência na tela da viagem. Com os dados gravados na
 * viagem, abre a tela (funciona sem internet). Sem dados, quem edita a viagem
 * busca sozinho na primeira abertura com internet — não depende de apertar
 * "Buscar". Quem só participa vê o botão do mesmo jeito: a tela mostra o
 * plantão do Itamaraty enquanto o organizador não buscou.
 */
export function CartaoEmergencia({ trip, editavel }: { trip: Trip; editavel: boolean }) {
  const on = useOnline();
  const nav = useNavigate();
  const { buscar, buscando } = useBuscarEmergencia(trip.id);
  const e = trip.emergencia;
  const temDados = !!(e && e.paises.length);
  const [tentou, setTentou] = useState(false);

  // Busca automática, uma vez por abertura, só com internet e só para quem edita.
  useEffect(() => {
    if (temDados || !editavel || !on || buscando || tentou) return;
    setTentou(true);
    void buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temDados, editavel, on]);

  const base =
    "tap shadow-soft flex w-full items-center gap-3 rounded-2xl bg-emerg px-4 py-3 text-left text-white";

  if (temDados) {
    const p = e!.paises[0]!;
    const n = numeroPrincipal(p);
    const cid = cidadesDosConsulados(e!);
    return (
      <Link to="/trip/$id/emergencia" params={{ id: trip.id }} className={base}>
        <Siren size={30} strokeWidth={2.2} className="shrink-0" />
        <span className="min-w-0 flex-1">
          <strong className="block text-xl font-extrabold">Emergência{n ? ` · ${n}` : ""}</strong>
          <span className="block text-base text-white/85">
            {cid.length ? `Consulado em ${cid.join(" e ")} · sem internet` : "Salvo · sem internet"}
          </span>
        </span>
        <ChevronRight size={24} className="shrink-0 text-white/85" />
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={buscando}
      onClick={async () => {
        if (editavel && on) {
          if (await buscar()) void nav({ to: "/trip/$id/emergencia", params: { id: trip.id } });
        } else void nav({ to: "/trip/$id/emergencia", params: { id: trip.id } });
      }}
      className={`${base} disabled:opacity-80`}
    >
      {buscando ? (
        <Loader2 size={30} className="shrink-0 animate-spin" />
      ) : (
        <Siren size={30} strokeWidth={2.2} className="shrink-0" />
      )}
      <span className="min-w-0 flex-1">
        <strong className="block text-xl font-extrabold">Emergência</strong>
        <span className="block text-base text-white/85">
          {buscando
            ? "Buscando telefones e consulado…"
            : editavel && on
              ? "Toque para buscar telefones e consulado"
              : editavel
                ? "Telefones do país chegam com internet · Itamaraty disponível"
                : "Plantão do Itamaraty"}
        </span>
      </span>
      <ChevronRight size={24} className="shrink-0 text-white/85" />
    </button>
  );
}
