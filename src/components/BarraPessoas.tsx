import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AvatarPessoa } from "./Pessoa";
import { conferirQuery, entryRulesQuery, membersQuery, ticketsQuery, tripsQuery } from "@/lib/data";
import { conferir, semEscondidos, regraPassaporte } from "@/lib/conferencia";
import { useEscondidos } from "@/lib/escondidos";
import { carregarAeroportos, porIata } from "@/lib/aeroportos";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const VAZIO: never[] = [];

/** Participantes da viagem em andamento (ou a próxima). Some sem viagem. */
export function BarraPessoas({ atualId }: { atualId: string }) {
  const { data: viagens = VAZIO } = useQuery(tripsQuery());
  const hoje = new Date().toISOString().slice(0, 10);
  const trip = useMemo(() => {
    const ativas = viagens.filter((v) => !v.arquivada_em && v.data_fim >= hoje);
    return ativas.find((v) => v.data_inicio <= hoje) ?? [...ativas].sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))[0] ?? null;
  }, [viagens, hoje]);
  const tid = trip?.id ?? "";
  const { data: membros = VAZIO } = useQuery({ ...membersQuery(tid), enabled: Boolean(trip) });
  const { data: lista = VAZIO } = useQuery({ ...conferirQuery(tid), enabled: Boolean(trip) });
  const { data: regras = VAZIO } = useQuery(entryRulesQuery());
  const { data: bilhetes = VAZIO } = useQuery({ ...ticketsQuery(tid), enabled: Boolean(trip) });
  const [paises, setPaises] = useState<string[]>([]);
  useEffect(() => {
    void carregarAeroportos().then((a) => setPaises([...new Set(bilhetes.map((b) => (b.destino_iata ? porIata(a, b.destino_iata)?.pais : null)).filter((x): x is string => Boolean(x) && x !== "BR"))]));
  }, [bilhetes]);
  const ids = membros.map((m) => m.person_id);
  const { data: fotos = {} } = useQuery({
    queryKey: ["barra-fotos", ids.join(",")],
    networkMode: "offlineFirst",
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await db.from("person").select("id,foto_url").in("id", ids);
      return Object.fromEntries(((data ?? []) as { id: string; foto_url: string | null }[]).map((p) => [p.id, p.foto_url])) as Record<string, string | null>;
    },
  });

  if (!trip) return null;
  const ativos = membros.filter((m) => m.status !== "recusado" && m.status !== "saiu");
  if (!ativos.length) return null;
  const eu = ativos.find((m) => m.meu && m.kind === "self");
  const ordem = eu ? [eu, ...ativos.filter((m) => m !== eu)] : ativos;
  const ajuste = (trip as unknown as { regra_passaporte?: { meses?: number; base?: string } | null }).regra_passaporte ?? null;
  const regra = regraPassaporte(trip, paises, ajuste);
  const destino = trip.cidades?.[0] || trip.destino || trip.nome;

  return (
    <div>
      <Link to="/trip/$id" params={{ id: trip.id }} className="mb-1 inline-block text-sm font-semibold text-muted-foreground">
        {destino} · {trip.data_inicio.slice(8, 10)}/{trip.data_inicio.slice(5, 7)}
      </Link>
      <nav aria-label="Participantes da viagem" className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {ordem.map((m) => {
          const c = lista.find((x) => x.person_id === m.person_id);
          const podeVer = m.meu || Boolean(c?.acesso);
          const k = c ? semEscondidos(conferir(c, trip, destino, paises, regra, regras), trip.id, oculto) : null;
          const alerta = k?.nivel === "resolver" ? "danger" : k?.nivel === "conferir" ? "warn" : null;
          const ativo = m.person_id === atualId;
          const nome = m === eu ? "Eu" : (m.apelido || m.nome).split(" ")[0];
          const corpo = (
            <>
              <span className={`relative rounded-full p-0.5 ${ativo ? "ring-4 ring-ok" : ""}`}>
                <AvatarPessoa nome={m.nome} foto={fotos[m.person_id] ?? null} tamanho={56} />
                {alerta && <span aria-label={alerta === "danger" ? "Precisa resolver" : "Conferir"} className={`absolute right-0 top-0 h-4 w-4 rounded-full border-2 border-background ${alerta === "danger" ? "bg-danger" : "bg-warn"}`} />}
                {!podeVer && <span aria-label="Sem acesso à ficha" className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-muted text-foreground"><Lock size={11} strokeWidth={2.6} /></span>}
              </span>
              <span className={`max-w-[72px] truncate text-sm ${ativo ? "font-bold" : ""}`}>{nome}</span>
            </>
          );
          const cls = "flex shrink-0 flex-col items-center gap-1";
          if (m === eu) return <Link key={m.id} to="/" className={cls} aria-current={ativo ? "page" : undefined}>{corpo}</Link>;
          if (podeVer) return <Link key={m.id} to="/pessoas/$pid" params={{ pid: m.person_id }} className={cls} aria-current={ativo ? "page" : undefined}>{corpo}</Link>;
          return <Link key={m.id} to="/trip/$id/revisao" params={{ id: trip.id }} hash={`p-${m.person_id}`} className={cls}>{corpo}</Link>;
        })}
      </nav>
    </div>
  );
}
