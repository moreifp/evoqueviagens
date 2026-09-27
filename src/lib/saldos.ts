import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { settlementsQuery, type Acerto, type Expense, type Membro } from "./data";
import { saldosDaViagem, simplificarDividas } from "./divisao";
import { nomeCurto } from "./despesas";
import { mutar } from "./outbox";
import { fmtMoney } from "./format";
import { origemApp } from "./site";

export const hojeISO = () => new Date().toISOString().slice(0, 10);

/** Saldos da viagem (centavos) com quem sai continuando até zerar. */
export function resumoSaldos(despesas: Expense[], acertos: Acerto[], membros: Membro[]) {
  const saldos = saldosDaViagem(despesas, acertos);
  const dividas = simplificarDividas(saldos);
  const ativos = membros.filter((m) => m.status !== "recusado" && m.status !== "saiu").map((m) => m.person_id);
  const saiuComSaldo = membros.filter((m) => m.status === "saiu" && (saldos[m.person_id] ?? 0) !== 0).map((m) => m.person_id);
  const extras = Object.keys(saldos).filter((p) => saldos[p] !== 0 && !ativos.includes(p) && !saiuComSaldo.includes(p));
  const pessoas = [...new Set([...ativos, ...saiuComSaldo, ...extras])];
  const saiu = (p: string) => membros.find((m) => m.person_id === p)?.status === "saiu";
  const eu = membros.find((m) => m.meu && m.kind === "self")?.person_id ?? membros.find((m) => m.meu)?.person_id;
  return { saldos, dividas, pessoas, saiu, eu };
}

export const juntar = (l: string[]) => (l.length <= 1 ? l.join("") : `${l.slice(0, -1).join(", ")} e ${l[l.length - 1]}`);

/** Frase do saldo: "Você deve € 236,00 ao Fausto" / "Gabriela deve € 320,00 ao Fausto". */
export function fraseSaldo(pid: string, saldoC: number, dividas: { de: string; para: string; centavos: number }[], membros: Membro[], moeda: string, voce: boolean) {
  const $ = fmtMoney(Math.abs(saldoC) / 100, moeda);
  const quem = voce ? "Você" : nomeCurto(membros, pid);
  if (saldoC === 0) return voce ? "Você está em dia" : `${quem} está em dia`;
  if (saldoC < 0) {
    const para = dividas.filter((d) => d.de === pid).map((d) => nomeCurto(membros, d.para));
    return `${quem} deve ${$}${para.length ? ` a ${juntar(para)}` : ""}`;
  }
  const de = dividas.filter((d) => d.para === pid).map((d) => nomeCurto(membros, d.de));
  return `${quem} ${voce ? "recebe" : "recebe"} ${$}${de.length ? ` de ${juntar(de)}` : ""}`;
}

export const textoCompartilhar = (viagem: string, frase: string) => `${viagem} · ${frase}. Detalhes no Evoque: ${origemApp()}`;

/** Registrar e desfazer acertos (fila offline; Desfazer 10 s). */
export function useAcertos(tripId: string) {
  const qc = useQueryClient();
  const key = settlementsQuery(tripId).queryKey;

  async function apagar(a: Acerto, silencioso = false) {
    qc.setQueryData<Acerto[]>(key, (l) => (l ?? []).filter((x) => x.id !== a.id));
    await mutar({ tipo: "update", tabela: "settlement", id: a.id, valores: { deleted_at: new Date().toISOString() } });
    if (silencioso) return;
    toast("Acerto apagado", {
      duration: 10_000,
      action: { label: "Desfazer", onClick: async () => { qc.setQueryData<Acerto[]>(key, (l) => [a, ...(l ?? [])]); await mutar({ tipo: "update", tabela: "settlement", id: a.id, valores: { deleted_at: null } }); } },
    });
  }

  async function registrar(de: string, para: string, c: number, nota: string | null = null) {
    const novo: Acerto = { id: crypto.randomUUID(), trip_id: tripId, de_person_id: de, para_person_id: para, valor_moeda_base: c / 100, data: hojeISO(), nota, registrado_por: null, created_at: new Date().toISOString(), deleted_at: null };
    qc.setQueryData<Acerto[]>(key, (l) => [novo, ...(l ?? [])]);
    try {
      const { registrado_por: _r, created_at: _c, deleted_at: _d, ...valores } = novo;
      const r = await mutar({ tipo: "insert", tabela: "settlement", valores });
      toast(r === "fila" ? "Pago · salvo no aparelho, sobe depois" : "Pago hoje · no histórico", { duration: 10_000, action: { label: "Desfazer", onClick: () => void apagar(novo, true) } });
      if (r !== "fila") void qc.invalidateQueries({ queryKey: key });
    } catch {
      qc.setQueryData<Acerto[]>(key, (l) => (l ?? []).filter((a) => a.id !== novo.id));
      toast.error("Não foi possível registrar o acerto.");
    }
  }
  return { registrar, apagar };
}
