import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ListTree, Share2 } from "lucide-react";
import type { Acerto, Expense, Membro } from "@/lib/data";
import { nomeCompleto, nomeCurto } from "@/lib/despesas";
import { fmtMoney } from "@/lib/format";
import { fraseSaldo, resumoSaldos, textoCompartilhar } from "@/lib/saldos";
import { AvatarPessoa } from "./Pessoa";
import { CompartilharTexto } from "./CompartilharTexto";

type Props = { tripId: string; tripNome: string; despesas: Expense[]; acertos: Acerto[]; membros: Membro[]; moeda: string; org: boolean };

export const corSaldo = (c: number) => (c > 0 ? "text-recebe" : c < 0 ? "text-deve" : "text-emdia");
export const rotuloSaldo = (c: number) => (c > 0 ? "recebe" : c < 0 ? "deve" : "em dia");

/** Cartões de saldo (grade 2 colunas) e, para o participante, o cartão dele no topo. */
export function SaldosViagem({ tripId, tripNome, despesas, acertos, membros, moeda, org }: Props) {
  const [compartilhar, setCompartilhar] = useState(false);
  const { saldos, dividas, pessoas, saiu, eu } = resumoSaldos(despesas, acertos, membros);
  if (!despesas.some((d) => !d.pessoal) && acertos.length === 0) return null;
  const organizador = membros.find((m) => m.papel === "owner");
  const meu = eu ? saldos[eu] ?? 0 : 0;
  const frase = eu ? fraseSaldo(eu, meu, dividas, membros, moeda, true) : "";

  return (
    <div className="space-y-3">
      {!org && eu && (
        <section className={`rounded-3xl border-2 bg-card p-5 ${meu < 0 ? "border-deve/40" : meu > 0 ? "border-recebe/40" : "border-border"}`}>
          <p className={`text-lg font-bold ${corSaldo(meu)}`}>{meu < 0 ? "Você deve" : meu > 0 ? "Você recebe" : "Você está em dia"}</p>
          {meu !== 0 && <p className={`num mt-1 text-[44px] leading-none ${corSaldo(meu)}`}>{fmtMoney(Math.abs(meu) / 100, moeda)}</p>}
          <p className="mt-2 text-lg text-foreground">{frase}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link to="/trip/$id/despesas/saldo/$pid" params={{ id: tripId, pid: eu }} className="tap flex items-center justify-center gap-2 rounded-2xl border-2 border-primary text-base font-bold text-foreground"><ListTree size={24} strokeWidth={2.2} /> De onde vem</Link>
            <button onClick={() => setCompartilhar(true)} className="tap flex items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-primary-foreground"><Share2 size={24} strokeWidth={2.2} /> Compartilhar</button>
          </div>
          {meu < 0 && <p className="mt-3 text-base text-muted-foreground">Pagou? Avise {organizador ? `o ${nomeCurto(membros, organizador.person_id)}` : "o organizador"}: ele registra o acerto.</p>}
          <CompartilharTexto aberto={compartilhar} onOpenChange={setCompartilhar} titulo="Compartilhar saldo" texto={textoCompartilhar(tripNome, frase)} />
        </section>
      )}

      <section>
        {!org && <h2 className="mb-2 text-lg font-bold text-foreground">Todos</h2>}
        <ul className="grid grid-cols-2 gap-2">
          {pessoas.map((p) => {
            const v = saldos[p] ?? 0;
            const voce = p === eu;
            const nome = nomeCurto(membros, p);
            return (
              <li key={p}>
                <Link to="/trip/$id/despesas/saldo/$pid" params={{ id: tripId, pid: p }} className={`flex h-full min-h-28 flex-col gap-1 rounded-2xl border bg-card p-3 shadow-soft ${voce && !org ? "border-2 border-teal" : "border-border"}`}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0"><AvatarPessoa nome={nomeCompleto(membros, p)} foto={null} tamanho={40} /></span>
                    <span className="min-w-0 flex-1 truncate text-base font-bold text-foreground">{voce ? "Você" : nome}</span>
                  </span>
                  <span className={`text-sm font-bold ${corSaldo(v)}`}>{rotuloSaldo(v)}{saiu(p) ? " · saiu" : ""}</span>
                  <span className={`num text-2xl leading-none ${corSaldo(v)}`}>{fmtMoney(Math.abs(v) / 100, moeda)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
