import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Check, ChevronDown, HandCoins, Trash2 } from "lucide-react";
import { settlementsQuery, type Acerto, type Expense, type Membro } from "@/lib/data";
import { saldosDaViagem, simplificarDividas } from "@/lib/divisao";
import { nomeCurto } from "@/lib/despesas";
import { mutar } from "@/lib/outbox";
import { fmtMoney } from "@/lib/format";

type Props = { tripId: string; despesas: Expense[]; acertos: Acerto[]; membros: Membro[]; moeda: string; org: boolean };

const hoje = () => new Date().toISOString().slice(0, 10);
const fmtData = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Saldos (positivo = tem a receber), sugestão de acertos e histórico. Quem deve paga a quem tem a receber. */
export function SaldosViagem({ tripId, despesas, acertos, membros, moeda, org }: Props) {
  const qc = useQueryClient();
  const key = settlementsQuery(tripId).queryKey;
  const [verTodos, setVerTodos] = useState(false);
  const [verAcertos, setVerAcertos] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);

  const saldos = saldosDaViagem(despesas, acertos);
  const pessoas = [...new Set([...membros.map((m) => m.person_id), ...Object.keys(saldos)])];
  const dividas = simplificarDividas(saldos);
  const eu = membros.find((m) => m.meu)?.person_id;
  const meuSaldo = eu ? saldos[eu] ?? 0 : 0;
  const nome = (p: string) => (p === eu ? "Você" : nomeCurto(membros, p));
  const $ = (c: number) => fmtMoney(c / 100, moeda);
  const temDespesa = despesas.some((d) => !d.pessoal);

  async function registrar(de: string, para: string, c: number) {
    const k = `${de}-${para}`;
    setSalvando(k);
    const novo: Acerto = { id: crypto.randomUUID(), trip_id: tripId, de_person_id: de, para_person_id: para, valor_moeda_base: c / 100, data: hoje(), nota: null, registrado_por: null, created_at: new Date().toISOString(), deleted_at: null };
    try {
      qc.setQueryData<Acerto[]>(key, (l) => [novo, ...(l ?? [])]);
      const { registrado_por: _r, created_at: _c, deleted_at: _d, ...valores } = novo;
      const r = await mutar({ tipo: "insert", tabela: "settlement", valores });
      toast(r === "fila" ? "Acerto salvo no aparelho · sobe depois" : `Acerto registrado: ${nome(de)} → ${nome(para)}`, {
        duration: 10_000,
        action: { label: "Desfazer", onClick: () => void apagar(novo, true) },
      });
    } catch {
      qc.setQueryData<Acerto[]>(key, (l) => (l ?? []).filter((a) => a.id !== novo.id));
      toast.error("Não foi possível registrar o acerto.");
    } finally { setSalvando(null); }
  }

  async function apagar(a: Acerto, silencioso = false) {
    qc.setQueryData<Acerto[]>(key, (l) => (l ?? []).filter((x) => x.id !== a.id));
    await mutar({ tipo: "update", tabela: "settlement", id: a.id, valores: { deleted_at: new Date().toISOString() } });
    if (silencioso) return;
    toast("Acerto apagado", {
      duration: 10_000,
      action: {
        label: "Desfazer",
        onClick: async () => {
          qc.setQueryData<Acerto[]>(key, (l) => [a, ...(l ?? [])]);
          await mutar({ tipo: "update", tabela: "settlement", id: a.id, valores: { deleted_at: null } });
        },
      },
    });
  }

  if (!temDespesa && acertos.length === 0) return null;

  return (
    <div className="space-y-3">
      {eu && (
        <section className={`rounded-3xl border-2 p-5 ${meuSaldo < 0 ? "border-destructive/40 bg-destructive/5" : meuSaldo > 0 ? "border-success/40 bg-success/10" : "border-border bg-card"}`}>
          <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Seu saldo</p>
          <p className={`num mt-1 text-[40px] leading-none ${meuSaldo < 0 ? "text-destructive" : meuSaldo > 0 ? "text-success" : "text-foreground"}`}>{$(Math.abs(meuSaldo))}</p>
          <p className="mt-2 text-lg font-semibold text-foreground">{meuSaldo < 0 ? "Você deve" : meuSaldo > 0 ? "Você tem a receber" : "Você está quite"}</p>
          {dividas.filter((d) => d.de === eu || d.para === eu).map((d) => (
            <p key={`${d.de}-${d.para}`} className="text-base text-foreground">{d.de === eu ? `Pague ${$(d.centavos)} a ${nome(d.para)}` : `${nome(d.de)} paga ${$(d.centavos)} a você`}</p>
          ))}
        </section>
      )}

      <section className="rounded-3xl bg-card p-4 shadow-soft">
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground"><HandCoins size={24} strokeWidth={2.2} /> Quem paga a quem</h2>
        {dividas.length === 0
          ? <p className="mt-3 flex items-center gap-2 text-lg font-semibold text-success"><Check size={24} strokeWidth={2.4} /> Tudo acertado</p>
          : <ul className="mt-3 space-y-2">
            {dividas.map((d) => {
              const k = `${d.de}-${d.para}`;
              return (
                <li key={k} className="rounded-2xl bg-muted p-3">
                  <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <span className="truncate">{nome(d.de)}</span><ArrowRight size={22} strokeWidth={2.2} className="shrink-0" /><span className="truncate">{nome(d.para)}</span>
                    <span className="num ml-auto text-xl">{$(d.centavos)}</span>
                  </div>
                  {org && (
                    <button disabled={salvando === k} onClick={() => void registrar(d.de, d.para, d.centavos)} className="tap mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-navy text-base font-bold text-primary-foreground disabled:opacity-60">
                      <Check size={22} strokeWidth={2.4} /> Marcar como pago
                    </button>
                  )}
                </li>
              );
            })}
          </ul>}

        <button onClick={() => setVerTodos((v) => !v)} aria-expanded={verTodos} className="tap mt-2 flex w-full items-center justify-between text-base font-bold text-foreground">
          Saldo de cada um <ChevronDown size={24} strokeWidth={2.2} className={verTodos ? "rotate-180" : ""} />
        </button>
        {verTodos && (
          <ul className="divide-y divide-border">
            {pessoas.map((p) => {
              const v = saldos[p] ?? 0;
              return (
                <li key={p} className="flex min-h-14 items-center justify-between text-lg">
                  <span className="font-semibold text-foreground">{nome(p)}</span>
                  <span className={`num ${v < 0 ? "text-destructive" : v > 0 ? "text-success" : "text-muted-foreground"}`}>{v === 0 ? "quite" : `${v < 0 ? "deve " : "recebe "}${$(Math.abs(v))}`}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {acertos.length > 0 && (
        <section className="rounded-3xl bg-card p-4 shadow-soft">
          <button onClick={() => setVerAcertos((v) => !v)} aria-expanded={verAcertos} className="tap flex w-full items-center justify-between text-lg font-bold text-foreground">
            Acertos feitos ({acertos.length}) <ChevronDown size={24} strokeWidth={2.2} className={verAcertos ? "rotate-180" : ""} />
          </button>
          {verAcertos && (
            <ul className="divide-y divide-border">
              {acertos.map((a) => (
                <li key={a.id} className="flex min-h-14 items-center gap-2 text-base">
                  <span className="text-muted-foreground">{fmtData(a.data)}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{nome(a.de_person_id)} → {nome(a.para_person_id)}</span>
                  <span className="num text-lg">{fmtMoney(Number(a.valor_moeda_base), moeda)}</span>
                  {org && <button onClick={() => void apagar(a)} aria-label="Apagar acerto" className="tap flex items-center justify-center rounded-xl text-destructive"><Trash2 size={22} strokeWidth={2.2} /></button>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
