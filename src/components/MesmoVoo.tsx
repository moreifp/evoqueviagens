import { useState } from "react";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, CheckCircle2, Circle, Plane } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { membersQuery, ticketsQuery, type Passageiro, type Ticket } from "@/lib/data";
import { chaveDia, dataBRCurta, horaNoFuso } from "@/lib/format";
import { aviso, naTela, novoId } from "@/lib/itens";
import { mutar } from "@/lib/outbox";
import { BAGAGEM_VAZIA, pegarBagagem, temBagagem, type Bagagem } from "@/lib/bagagem";
import { Campo, inputCls } from "@/components/Form";
import type { PessoalLido } from "@/components/FormBilhete";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Trechos do organizador + dados pessoais de UMA pessoa. Voo é compartilhado; a linha é dela. */
export function MesmoVoo({
  tripId,
  pid,
  iniciais = [],
  lido,
  fixo,
  onFeito,
}: {
  tripId: string;
  pid: string;
  iniciais?: string[];
  lido?: PessoalLido;
  fixo?: boolean;
  onFeito: () => void;
}) {
  const qc = useQueryClient();
  const { data: bilhetes } = useSuspenseQuery(ticketsQuery(tripId));
  const { data: membros } = useSuspenseQuery(membersQuery(tripId));
  const dono = membros.find((m) => m.papel === "owner");
  const pessoa = membros.find((m) => m.person_id === pid);
  const trechos = fixo
    ? bilhetes.filter((b) => iniciais.includes(b.id))
    : bilhetes.filter((b) => b.passageiros.some((p) => p.person_id === dono?.person_id));
  const [sel, setSel] = useState<string[]>(iniciais);
  const [passo, setPasso] = useState<"trechos" | "dados">(
    fixo || iniciais.length ? "dados" : "trechos",
  );
  const atual = (tid: string) =>
    bilhetes.find((b) => b.id === tid)?.passageiros.find((p) => p.person_id === pid);
  const p0 = sel.map(atual).find(Boolean);
  const [d, setD] = useState(() => ({
    nome: p0?.nome_no_bilhete ?? lido?.nome_no_bilhete ?? pessoa?.nome_como_no_documento ?? "",
    localizador: p0?.localizador ?? lido?.localizador ?? "",
    eticket: p0?.eticket ?? lido?.eticket ?? "",
    classe: p0?.classe ?? "",
    fid: p0?.loyalty_account_id ?? "",
  }));
  const [assentos, setAssentos] = useState<Record<string, string>>(() =>
    Object.fromEntries(iniciais.map((t) => [t, atual(t)?.assento ?? lido?.assento ?? ""])),
  );
  const [bag, setBag] = useState<Bagagem>(() =>
    p0 && temBagagem(pegarBagagem(p0)) ? pegarBagagem(p0) : BAGAGEM_VAZIA,
  );
  const [salvando, setSalvando] = useState(false);
  const { data: fids = [] } = useQuery({
    queryKey: ["fidelidade-pessoa", pid],
    networkMode: "offlineFirst",
    queryFn: async () =>
      ((
        await db
          .from("loyalty_account")
          .select("id,programa,numero")
          .eq("person_id", pid)
          .is("deleted_at", null)
      ).data ?? []) as { id: string; programa: string; numero: string | null }[],
  });

  async function salvar() {
    setSalvando(true);
    try {
      let r: "salvo" | "fila" = "salvo";
      for (const tid of sel) {
        const ja = atual(tid);
        const linha = {
          nome_no_bilhete: d.nome.trim().toUpperCase() || null,
          assento: (assentos[tid] ?? "").trim().toUpperCase() || null,
          eticket: d.eticket.trim() || null,
          localizador: d.localizador.trim().toUpperCase() || null,
          classe: d.classe.trim() || null,
          loyalty_account_id: d.fid || null,
          ...bag,
        };
        const id = ja?.id ?? novoId();
        const x = ja
          ? await mutar({ tipo: "update", tabela: "ticket_passenger", id, valores: linha })
          : await mutar({
              tipo: "insert",
              tabela: "ticket_passenger",
              valores: { id, ticket_id: tid, person_id: pid, ...linha },
            });
        if (x === "fila") r = "fila";
        naTela<Ticket>(qc, ticketsQuery(tripId).queryKey, (l) =>
          l.map((b) =>
            b.id !== tid
              ? b
              : {
                  ...b,
                  passageiros: [
                    ...b.passageiros.filter((p) => p.id !== id),
                    { ...(ja ?? {}), id, ticket_id: tid, person_id: pid, ...linha } as Passageiro,
                  ],
                },
          ),
        );
      }
      toast.success(aviso(r, "Bilhete salvo"));
      if (r === "salvo") void qc.invalidateQueries({ queryKey: ["roteiro", tripId] });
      onFeito();
    } catch (e) {
      toast.error((e as Error).message || "Não deu para salvar.");
      void qc.invalidateQueries({ queryKey: ["tickets", tripId] });
      setSalvando(false);
    }
  }

  if (passo === "trechos")
    return (
      <div className="space-y-3 px-4 pt-4">
        <h2 className="text-2xl font-bold">Quais voos?</h2>
        {trechos.length === 0 && (
          <p className="text-lg text-muted-foreground">O organizador ainda não tem voos.</p>
        )}
        {trechos.map((b) => {
          const on = sel.includes(b.id);
          const Ic = on ? CheckCircle2 : Circle;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setSel((s) => (on ? s.filter((x) => x !== b.id) : [...s, b.id]))}
              className={`tap flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left ${on ? "border-primary bg-card" : "border-border bg-card"}`}
            >
              <Ic
                size={32}
                strokeWidth={2.2}
                className={on ? "text-primary" : "text-muted-foreground"}
              />
              <span className="min-w-0 flex-1">
                <span className="mono-code block text-xl font-bold">
                  {[b.companhia, b.numero].filter(Boolean).join(" ") || "Voo"}
                </span>
                <span className="block text-lg font-semibold">
                  {b.origem_iata ?? b.origem_cidade ?? "?"} →{" "}
                  {b.destino_iata ?? b.destino_cidade ?? "?"}
                </span>
                <span className="block text-base text-muted-foreground">
                  {dataBRCurta(chaveDia(b.partida_utc, b.partida_tz))} ·{" "}
                  {horaNoFuso(b.partida_utc, b.partida_tz)}
                </span>
              </span>
            </button>
          );
        })}
        <button
          type="button"
          disabled={!sel.length}
          onClick={() => {
            setAssentos((a) =>
              Object.fromEntries(sel.map((t) => [t, a[t] ?? atual(t)?.assento ?? ""])),
            );
            setPasso("dados");
          }}
          className="gradient-hero shadow-medium tap flex w-full items-center justify-center gap-3 rounded-2xl text-xl font-bold disabled:opacity-50"
        >
          Continuar{sel.length > 1 ? ` · ${sel.length} voos` : ""}
        </button>
      </div>
    );

  const num = (k: keyof Bagagem) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = e.target.value.replace(",", ".");
    setBag((v) => ({ ...v, [k]: t === "" ? null : Number(t) }));
  };
  const v = (k: keyof Bagagem) => (bag[k] == null ? "" : String(bag[k]));
  return (
    <div className="space-y-4 px-4 pt-4">
      <h2 className="text-2xl font-bold">
        Dados de {pessoa?.apelido || pessoa?.nome.split(" ")[0] || "passageiro"}
      </h2>
      <Campo rotulo="Nome como no bilhete">
        <input
          value={d.nome}
          onChange={(e) => setD({ ...d, nome: e.target.value })}
          className={inputCls}
        />
      </Campo>
      {sel.map((tid) => {
        const b = bilhetes.find((x) => x.id === tid);
        return (
          <Campo
            key={tid}
            rotulo={`Assento · ${b ? `${b.origem_iata ?? "?"} → ${b.destino_iata ?? "?"}` : ""}`}
          >
            <div className="flex items-center gap-3">
              <Plane size={26} strokeWidth={2.2} className="text-accent" />
              <input
                value={assentos[tid] ?? ""}
                onChange={(e) => setAssentos((a) => ({ ...a, [tid]: e.target.value }))}
                placeholder="14C"
                className={`${inputCls} mono-code`}
              />
            </div>
          </Campo>
        );
      })}
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Localizador">
          <input
            value={d.localizador}
            onChange={(e) => setD({ ...d, localizador: e.target.value })}
            className={`${inputCls} mono-code`}
          />
        </Campo>
        <Campo rotulo="Nº do bilhete">
          <input
            inputMode="numeric"
            value={d.eticket}
            onChange={(e) => setD({ ...d, eticket: e.target.value })}
            className={`${inputCls} mono-code`}
          />
        </Campo>
      </div>
      <Campo rotulo="Classe">
        <select
          value={d.classe}
          onChange={(e) => setD({ ...d, classe: e.target.value })}
          className={inputCls}
        >
          <option value="">—</option>
          <option>Econômica</option>
          <option>Premium</option>
          <option>Executiva</option>
          <option>Primeira</option>
        </select>
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Mala de mão · qtd">
          <input
            inputMode="numeric"
            value={v("bag_mao_qtd")}
            onChange={num("bag_mao_qtd")}
            className={inputCls}
          />
        </Campo>
        <Campo rotulo="Despachadas · qtd">
          <input
            inputMode="numeric"
            value={v("bag_desp_qtd")}
            onChange={num("bag_desp_qtd")}
            className={inputCls}
          />
        </Campo>
        <Campo rotulo="Mão · kg">
          <input
            inputMode="decimal"
            value={v("bag_mao_kg")}
            onChange={num("bag_mao_kg")}
            className={inputCls}
          />
        </Campo>
        <Campo rotulo="Kg por mala">
          <input
            inputMode="decimal"
            value={v("bag_desp_kg")}
            onChange={num("bag_desp_kg")}
            className={inputCls}
          />
        </Campo>
      </div>
      {fids.length > 0 && (
        <Campo rotulo="Fidelidade">
          <select
            value={d.fid}
            onChange={(e) => setD({ ...d, fid: e.target.value })}
            className={inputCls}
          >
            <option value="">Nenhuma</option>
            {fids.map((f) => (
              <option key={f.id} value={f.id}>
                {f.programa}
                {f.numero ? ` · ${f.numero}` : ""}
              </option>
            ))}
          </select>
        </Campo>
      )}
      <p className="text-base text-muted-foreground">
        Cartão de embarque: anexe no cartão do voo, depois de salvar.
      </p>
      <button
        type="button"
        disabled={salvando || !sel.length}
        onClick={salvar}
        className="gradient-hero shadow-medium tap flex w-full items-center justify-center gap-3 rounded-2xl text-xl font-bold"
      >
        <Check size={28} strokeWidth={2.2} /> Salvar
      </button>
    </div>
  );
}
