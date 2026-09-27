import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, Check, ChevronLeft, Eye, Trash2 } from "lucide-react";
import { expensesQuery, membersQuery, settlementsQuery, tripQuery } from "@/lib/data";
import { dividasCruzadas } from "@/lib/divisao";
import { nomeCurto, useUid } from "@/lib/despesas";
import { dataBRCurta, fmtMoney } from "@/lib/format";
import { resumoSaldos, useAcertos } from "@/lib/saldos";
import { AvatarPessoa } from "@/components/Pessoa";

export const Route = createFileRoute("/trip/$id/despesas/acertar")({
  head: () => ({
    meta: [
      { title: "Acertar contas — Evoque Viagens" },
      { name: "description", content: "Os pagamentos que zeram as contas da viagem e o histórico de acertos." },
      { property: "og:title", content: "Acertar contas — Evoque Viagens" },
      { property: "og:description", content: "Os pagamentos que zeram as contas da viagem e o histórico de acertos." },
    ],
  }),
  component: Acertar,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-lg">{error.message}</div>,
});

function Acertar() {
  const { id } = Route.useParams();
  const uid = useUid();
  const { data: trip } = useSuspenseQuery(tripQuery(id));
  const { data: despesas } = useSuspenseQuery(expensesQuery(id));
  const { data: membros } = useSuspenseQuery(membersQuery(id));
  const { data: acertos } = useSuspenseQuery(settlementsQuery(id));
  const { registrar, apagar } = useAcertos(id);
  const org = uid === trip.owner_id;
  const moeda = trip.moeda_base;
  const $ = (c: number) => fmtMoney(c / 100, moeda);
  const { dividas, pessoas } = resumoSaldos(despesas, acertos, membros);
  const cruzadas = dividasCruzadas(despesas, acertos);
  const nome = (p: string) => nomeCurto(membros, p);
  const dono = membros.find((m) => m.papel === "owner");

  const [outro, setOutro] = useState(false);
  const [de, setDe] = useState("");
  const [para, setPara] = useState("");
  const [valor, setValor] = useState("");
  const valorC = Math.round((Number(valor.replace(",", ".")) || 0) * 100);
  const podeOutro = de && para && de !== para && valorC > 0;

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="flex items-center gap-2 px-3 py-2">
        <Link to="/trip/$id/despesas" params={{ id }} aria-label="Voltar" className="tap flex flex-col items-center justify-center rounded-xl text-foreground"><ChevronLeft size={28} strokeWidth={2.2} /><span className="text-xs font-semibold">Voltar</span></Link>
        <h1 className="flex-1 truncate text-3xl">Acertar contas</h1>
      </header>
      <main className="space-y-4 px-4">
        {!org && uid !== undefined && <p className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm font-bold"><Eye size={18} strokeWidth={2.2} /> Só leitura</p>}

        {dividas.length === 0 ? (
          <p className="flex items-center justify-center gap-2 rounded-3xl bg-card p-6 text-xl font-bold text-recebe shadow-soft"><Check size={28} strokeWidth={2.4} /> Tudo acertado</p>
        ) : (
          <>
            <p className="rounded-2xl bg-teal p-4 text-lg font-bold text-primary-foreground">
              {dividas.length} {dividas.length === 1 ? "pagamento zera" : "pagamentos zeram"} tudo{cruzadas > dividas.length ? ` · em vez de ${cruzadas}` : ""}
            </p>
            <ul className="space-y-2">
              {dividas.map((d) => (
                <li key={`${d.de}-${d.para}`} className="rounded-2xl border border-border bg-card p-3 shadow-soft">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0"><AvatarPessoa nome={nome(d.de)} foto={null} tamanho={40} /></span>
                    <ArrowRight size={20} strokeWidth={2.2} className="shrink-0" />
                    <span className="shrink-0"><AvatarPessoa nome={nome(d.para)} foto={null} tamanho={40} /></span>
                    <span className="min-w-0 flex-1 truncate text-lg font-semibold">{nome(d.de)} → {nome(d.para)}</span>
                    <span className="num shrink-0 text-xl">{$(d.centavos)}</span>
                  </div>
                  {org && <button onClick={() => void registrar(d.de, d.para, d.centavos)} className="tap mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-navy text-lg font-bold text-primary-foreground"><Check size={24} strokeWidth={2.4} /> Pago</button>}
                </li>
              ))}
            </ul>
          </>
        )}

        {org && (outro ? (
          <section className="space-y-3 rounded-2xl border-2 border-border bg-card p-4">
            <h2 className="text-lg font-bold">Outro valor ou pagamento parcial</h2>
            {([["De quem", de, setDe], ["Para quem", para, setPara]] as const).map(([r, v, set]) => (
              <div key={r}>
                <p className="mb-1 text-base font-semibold">{r}</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {pessoas.map((p) => (
                    <button key={p} onClick={() => set(p)} aria-pressed={v === p} className={`tap shrink-0 rounded-xl border-2 px-3 text-base font-bold ${v === p ? "border-navy bg-navy text-primary-foreground" : "border-border"}`}>{nome(p)}</button>
                  ))}
                </div>
              </div>
            ))}
            <label className="block"><span className="text-base font-semibold">Valor ({moeda})</span>
              <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className="tap mt-1 w-full rounded-xl border-2 border-input bg-background px-3 text-2xl font-bold" /></label>
            <div className="grid grid-cols-2 gap-2">
              <button disabled={!podeOutro} onClick={async () => { await registrar(de, para, valorC); setOutro(false); setValor(""); }} className="tap rounded-xl bg-navy text-lg font-bold text-primary-foreground disabled:opacity-50">Registrar</button>
              <button onClick={() => setOutro(false)} className="tap rounded-xl border-2 border-border text-lg font-bold">Cancelar</button>
            </div>
          </section>
        ) : (
          <button onClick={() => setOutro(true)} className="tap w-full rounded-2xl border-2 border-border bg-card text-lg font-bold">Outro valor ou pagamento parcial</button>
        ))}

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-lg font-bold">Histórico</h2>
          {acertos.length === 0 ? <p className="mt-2 text-base text-muted-foreground">Nenhum acerto ainda</p> : (
            <ul className="mt-2 divide-y divide-border">{acertos.map((a) => (
              <li key={a.id} className="flex min-h-16 items-center gap-2 text-base">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{nome(a.de_person_id)} → {nome(a.para_person_id)}</span>
                  <span className="block text-sm text-muted-foreground">{dataBRCurta(a.data)} · registrado por {dono ? nome(dono.person_id) : "organizador"}</span>
                </span>
                <span className="num text-lg">{fmtMoney(Number(a.valor_moeda_base), moeda)}</span>
                {org && <button onClick={() => void apagar(a)} aria-label="Apagar acerto" className="tap flex items-center justify-center rounded-xl text-destructive"><Trash2 size={22} strokeWidth={2.2} /></button>}
              </li>
            ))}</ul>
          )}
        </section>
      </main>
    </div>
  );
}
