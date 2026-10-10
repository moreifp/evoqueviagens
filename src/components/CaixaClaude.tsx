import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  BedDouble,
  Check,
  Pencil,
  Plane,
  Sparkles,
  Ticket,
  Trash2,
} from "lucide-react";
import { caixaClaudeQuery, tripsQuery, type ItemCaixa } from "@/lib/data";
import { abrirEdicao, confirmarItem, descartarItem } from "@/lib/caixaClaude";
import { aviso } from "@/lib/itens";
import { dataBRCurta } from "@/lib/format";

const ICONE = { voo: Plane, hotel: BedDouble, reserva: Ticket, despesa: Ticket } as const;

/** Chip âmbar "N itens chegaram pelo Claude" (some quando não há nada). */
export function ChipClaude({ tripId }: { tripId?: string }) {
  const { data } = useQuery(caixaClaudeQuery());
  const n = (data ?? []).filter(
    (i) => !tripId || i.trip_id === tripId || i.trip_id === null,
  ).length;
  if (!n) return null;
  const txt = `${n} ${n === 1 ? "item chegou" : "itens chegaram"} pelo Claude · Confirmar com um toque`;
  const cls =
    "tap flex items-center gap-3 rounded-2xl border-2 border-warn bg-warn/10 px-4 py-3 text-foreground";
  const conteudo = (
    <>
      <span className="num flex h-10 min-w-10 items-center justify-center rounded-full bg-warn px-2 text-lg font-extrabold text-warn-foreground">
        {n}
      </span>
      <span className="flex-1 text-lg font-bold">{txt}</span>
      <Sparkles size={26} strokeWidth={2.2} className="shrink-0 text-warn" />
    </>
  );
  return tripId ? (
    <Link to="/trip/$id/claude" params={{ id: tripId }} className={cls}>
      {conteudo}
    </Link>
  ) : (
    <Link to="/claude" className={cls}>
      {conteudo}
    </Link>
  );
}

function linhasResumo(i: ItemCaixa) {
  const p = i.payload_json as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const v = p.valores ?? {};
  const d = (iso?: string | null, tz?: string) =>
    iso
      ? `${dataBRCurta(new Intl.DateTimeFormat("en-CA", { timeZone: tz || "UTC" }).format(new Date(iso)))} ${new Intl.DateTimeFormat("pt-BR", { timeZone: tz || "UTC", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))}`
      : "";
  const l: string[] = [];
  if (i.tipo_alvo === "voo") {
    l.push(`${d(v.partida_utc, v.partida_tz)} → ${d(v.chegada_utc, v.chegada_tz)}`);
    const n = (p.passageiros ?? []).length;
    l.push(
      `${n} ${n === 1 ? "passageiro" : "passageiros"}${v.localizador ? ` · localizador ${v.localizador}` : ""}`,
    );
  } else if (i.tipo_alvo === "hotel") {
    l.push(`Entra ${d(v.checkin, v.tz)} · sai ${d(v.checkout, v.tz)}`);
    const q = p.quartos ?? [];
    const h = q.reduce((s: number, x: { hospedes: unknown[] }) => s + x.hospedes.length, 0);
    l.push(
      `${q.length} ${q.length === 1 ? "quarto" : "quartos"} · ${h} ${h === 1 ? "hóspede" : "hóspedes"}${v.localizador ? ` · ${v.localizador}` : ""}`,
    );
  } else {
    l.push(d(v.inicio_utc, v.inicio_tz) + (v.fim_utc ? ` até ${d(v.fim_utc, v.fim_tz)}` : ""));
    const n = (p.pessoas ?? []).length;
    l.push(
      [v.local, `${n} ${n === 1 ? "pessoa" : "pessoas"}`, v.localizador]
        .filter(Boolean)
        .join(" · "),
    );
  }
  return l;
}

function Cartao({ item, tripId }: { item: ItemCaixa; tripId: string | null }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: trips } = useQuery(tripsQuery());
  const [escolhida, setEscolhida] = useState(item.trip_id ?? "");
  const destino = tripId ?? item.trip_id ?? escolhida;
  const Icone = ICONE[item.tipo_alvo];
  const r = item.payload_json.resumo;
  const achados = item.achados_json ?? [];
  const avisos = r?.avisos ?? [];
  async function confirmar() {
    if (!destino) return toast.error("Escolha a viagem primeiro.");
    try {
      toast.success(aviso(await confirmarItem(qc, item, destino), "Confirmado · entrou na viagem"));
    } catch (e) {
      toast.error((e as Error).message || "Não deu para confirmar.");
    }
  }
  async function descartar() {
    try {
      toast.success(aviso(await descartarItem(qc, item), "Descartado"));
    } catch (e) {
      toast.error((e as Error).message || "Não deu para descartar.");
    }
  }
  function editar() {
    if (!destino) return toast.error("Escolha a viagem primeiro.");
    const rota = abrirEdicao(item, destino);
    void navigate({ to: `/trip/$id/${rota}` as never, params: { id: destino } as never });
  }
  return (
    <article
      className="space-y-3 rounded-[18px] border-2 border-border bg-card p-4"
      aria-label={r?.titulo ?? "Item"}
    >
      <div className="flex gap-3">
        <Icone size={32} strokeWidth={2.2} className="shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl">{r?.titulo ?? "Item"}</h2>
          {r?.origem && <p className="text-base text-muted-foreground">{r.origem}</p>}
        </div>
      </div>
      {linhasResumo(item).map((l) => (
        <p key={l} className="text-lg">
          {l}
        </p>
      ))}
      {[...achados.map((a) => a.mensagem), ...avisos].map((m) => (
        <p
          key={m}
          className="flex gap-2 rounded-xl border-2 border-warn bg-warn/10 p-3 text-lg font-semibold"
        >
          <AlertTriangle size={24} strokeWidth={2.2} className="shrink-0 text-warn" /> {m}
        </p>
      ))}
      {!tripId && !item.trip_id && (
        <label className="block text-lg font-bold">
          Viagem
          <select
            value={escolhida}
            onChange={(e) => setEscolhida(e.target.value)}
            className="mt-1 min-h-[56px] w-full rounded-xl border-2 border-input bg-background px-3 text-lg"
          >
            <option value="">Escolher viagem…</option>
            {(trips ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={descartar}
          className="tap flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-border text-lg font-bold text-destructive"
        >
          <Trash2 size={24} strokeWidth={2.2} /> Descartar
        </button>
        <button
          onClick={editar}
          className="tap flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-border text-lg font-bold"
        >
          <Pencil size={24} strokeWidth={2.2} /> Editar
        </button>
        <button
          onClick={confirmar}
          className="tap flex flex-col items-center justify-center gap-1 rounded-xl bg-primary text-lg font-bold text-primary-foreground"
        >
          <Check size={26} strokeWidth={2.4} /> Confirmar
        </button>
      </div>
    </article>
  );
}

export function CaixaClaude({ tripId }: { tripId?: string }) {
  const { data, isLoading } = useQuery(caixaClaudeQuery());
  const itens = (data ?? []).filter((i) => !tripId || i.trip_id === tripId || i.trip_id === null);
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 pb-10">
      {isLoading ? (
        <p className="text-lg">Carregando…</p>
      ) : itens.length === 0 ? (
        <p className="rounded-[18px] border-2 border-dashed border-border p-6 text-center text-lg">
          Nada esperando confirmação.
        </p>
      ) : (
        itens.map((i) => <Cartao key={i.id} item={i} tripId={tripId ?? null} />)
      )}
      <p className="rounded-[18px] bg-muted p-4 text-lg">
        <strong>Como mandar:</strong> no Claude, peça “procura no meu e-mail as reservas de Portugal
        e joga no Viagens Organizadas”. Ou mande o print do WhatsApp.
      </p>
    </main>
  );
}
