import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Check, ChevronLeft, MessageCircle } from "lucide-react";
import { expensesQuery, membersQuery, settlementsQuery, tripQuery } from "@/lib/data";
import { centavos, origemSaldo } from "@/lib/divisao";
import { nomeCompleto, nomeCurto, useUid } from "@/lib/despesas";
import { dataBRCurta, fmtMoney } from "@/lib/format";
import { fraseSaldo, resumoSaldos, textoCompartilhar, useAcertos } from "@/lib/saldos";
import { corSaldo } from "@/components/SaldosViagem";
import { CompartilharTexto } from "@/components/CompartilharTexto";
import { AvatarPessoa } from "@/components/Pessoa";

export const Route = createFileRoute("/trip/$id/despesas/saldo/$pid")({
  head: () => ({
    meta: [
      { title: "De onde vem o saldo — Evoque Viagens" },
      { name: "description", content: "O que a pessoa pagou, a parte dela e os acertos feitos." },
      { property: "og:title", content: "De onde vem o saldo — Evoque Viagens" },
      { property: "og:description", content: "O que a pessoa pagou, a parte dela e os acertos feitos." },
    ],
  }),
  component: DeOndeVem,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-lg">{error.message}</div>,
});

function DeOndeVem() {
  const { id, pid } = Route.useParams();
  const uid = useUid();
  const { data: trip } = useSuspenseQuery(tripQuery(id));
  const { data: despesas } = useSuspenseQuery(expensesQuery(id));
  const { data: membros } = useSuspenseQuery(membersQuery(id));
  const { data: acertos } = useSuspenseQuery(settlementsQuery(id));
  const { registrar } = useAcertos(id);
  const [compartilhar, setCompartilhar] = useState(false);
  const org = uid === trip.owner_id;
  const moeda = trip.moeda_base;
  const $ = (c: number) => fmtMoney(c / 100, moeda);
  const { dividas, eu, saiu } = resumoSaldos(despesas, acertos, membros);
  const o = origemSaldo(pid, despesas, acertos);
  const voce = pid === eu;
  const nome = voce ? "Você" : nomeCurto(membros, pid);
  const dela = voce ? "sua" : "dela";
  const frase = fraseSaldo(pid, o.saldoC, dividas, membros, moeda, voce);
  const minhas = dividas.filter((d) => d.de === pid || d.para === pid);
  const porId = new Map(despesas.map((d) => [d.id, d]));

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="flex items-center gap-2 px-3 py-2">
        <Link to="/trip/$id/despesas" params={{ id }} aria-label="Voltar" className="tap flex flex-col items-center justify-center rounded-xl text-foreground"><ChevronLeft size={28} strokeWidth={2.2} /><span className="text-xs font-semibold">Voltar</span></Link>
        <span className="shrink-0"><AvatarPessoa nome={nomeCompleto(membros, pid)} foto={null} tamanho={44} /></span>
        <h1 className="min-w-0 flex-1 truncate text-2xl">{nome}{saiu(pid) ? " · saiu" : ""}</h1>
      </header>
      <main className="space-y-4 px-4">
        <section className="rounded-3xl bg-card p-5 shadow-medium">
          <p className={`num text-[40px] leading-none ${corSaldo(o.saldoC)}`}>{o.saldoC === 0 ? "Em dia" : `${o.saldoC < 0 ? "Deve" : "Recebe"} ${$(Math.abs(o.saldoC))}`}</p>
          {minhas.length > 0 && <p className="mt-2 text-lg text-foreground">{minhas.map((d) => d.de === pid ? `para ${nomeCurto(membros, d.para)}` : `de ${nomeCurto(membros, d.de)}`).join(" · ")}, pelo Simplificar</p>}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[["Pagou", o.pagouC], [`Parte ${dela}`, o.parteC], ["Acertos", o.acertosC]].map(([r, v]) => (
              <div key={r as string} className="rounded-2xl bg-muted p-2"><p className="text-sm text-muted-foreground">{r}</p><p className="num text-lg">{$(v as number)}</p></div>
            ))}
          </div>
          <p className="mt-3 text-base text-foreground">{$(o.pagouC)} pagos − {$(o.parteC)} da parte {dela}{o.acertosC ? ` ${o.acertosC > 0 ? "+" : "−"} ${$(Math.abs(o.acertosC))} de acertos` : ""} = <strong className={corSaldo(o.saldoC)}>{o.saldoC === 0 ? "em dia" : `${o.saldoC < 0 ? "deve" : "recebe"} ${$(Math.abs(o.saldoC))}`}</strong></p>
        </section>

        <div className="grid grid-cols-1 gap-2">
          {org && minhas.filter((d) => d.de === pid).map((d) => (
            <button key={d.para} onClick={() => void registrar(d.de, d.para, d.centavos)} className="tap flex items-center justify-center gap-2 rounded-2xl bg-navy text-lg font-bold text-primary-foreground"><Check size={24} strokeWidth={2.4} /> Registrar acerto · {$(d.centavos)} para {nomeCurto(membros, d.para)}</button>
          ))}
          {org && minhas.filter((d) => d.para === pid).map((d) => (
            <button key={d.de} onClick={() => void registrar(d.de, d.para, d.centavos)} className="tap flex items-center justify-center gap-2 rounded-2xl bg-navy text-lg font-bold text-primary-foreground"><Check size={24} strokeWidth={2.4} /> Registrar acerto · {$(d.centavos)} de {nomeCurto(membros, d.de)}</button>
          ))}
          <button onClick={() => setCompartilhar(true)} className="tap flex items-center justify-center gap-2 rounded-2xl border-2 border-primary text-lg font-bold text-foreground"><MessageCircle size={24} strokeWidth={2.2} /> Mandar pelo WhatsApp</button>
        </div>
        <CompartilharTexto aberto={compartilhar} onOpenChange={setCompartilhar} titulo="Mandar saldo" texto={textoCompartilhar(trip.nome, frase)} />

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-lg font-bold">O que pagou</h2>
          {o.pagou.length === 0 ? <p className="mt-2 text-base text-muted-foreground">Nada</p> : (
            <ul className="mt-2 divide-y divide-border">{o.pagou.map((x, i) => { const d = porId.get(x.id)!; return (
              <li key={`${x.id}-${i}`}><Link to="/trip/$id/despesas/$eid" params={{ id, eid: x.id }} className="flex min-h-14 items-center gap-2 text-base"><span className="text-muted-foreground">{dataBRCurta(d.data)}</span><span className="min-w-0 flex-1 truncate font-semibold">{d.descricao}</span><span className="num text-lg">{$(x.c)}</span></Link></li>
            ); })}</ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-lg font-bold">A parte {dela}</h2>
          {o.parte.length === 0 ? <p className="mt-2 text-base text-muted-foreground">Nada</p> : (
            <ul className="mt-2 divide-y divide-border">{o.parte.map((x, i) => {
              const d = porId.get(x.id)!;
              const tot = centavos(d.valor_moeda_base);
              const n = d.partes.length;
              const base = Math.floor(tot / n);
              const comCentavo = d.divisao === "igual" && tot % n !== 0 && x.c > base;
              return (
                <li key={`${x.id}-${i}`}><Link to="/trip/$id/despesas/$eid" params={{ id, eid: x.id }} className="flex min-h-14 items-center gap-2 text-base">
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{d.descricao}</span><span className="block text-sm text-muted-foreground">{d.divisao === "igual" ? `${$(tot)} ÷ ${n}` : `${$(tot)} · ${d.divisao === "valor" ? "por valor" : d.divisao === "pct" ? "por %" : "por cotas"}`}{comCentavo ? " · com 1 centavo" : ""}</span></span>
                  <span className="num text-lg">{$(x.c)}</span>
                </Link></li>
              );
            })}</ul>
          )}
        </section>

        {o.acertos.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-lg font-bold">Acertos feitos</h2>
            <ul className="mt-2 divide-y divide-border">{o.acertos.map((a) => (
              <li key={a.id} className="flex min-h-14 items-center gap-2 text-base"><span className="text-muted-foreground">{dataBRCurta(a.data)}</span><span className="min-w-0 flex-1 truncate font-semibold">{nomeCurto(membros, a.de_person_id)} → {nomeCurto(membros, a.para_person_id)}</span><span className="num text-lg">{fmtMoney(Number(a.valor_moeda_base), moeda)}</span></li>
            ))}</ul>
          </section>
        )}
      </main>
    </div>
  );
}
