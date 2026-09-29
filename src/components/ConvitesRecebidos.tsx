import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { convitesQuery, confiancaQuery, tripsQuery, type ConviteRecebido } from "@/lib/data";
import { mutar } from "@/lib/outbox";
import { enviar, naTela } from "@/lib/itens";
import { supabase } from "@/integrations/supabase/client";
import { dataBRCurta } from "@/lib/format";

const NOME_RES: Record<string, string> = {
  carro: "carro",
  passeio: "passeio",
  restaurante: "restaurante",
  outro: "reserva",
  ingresso: "ingresso",
};

export function resumoConvite(c: ConviteRecebido) {
  const linhas: string[] = [];
  if (c.voos)
    linhas.push(
      `${c.voos} ${c.voos === 1 ? "voo" : "voos"} no ${c.dependente ? "nome de " + c.pessoa : "seu nome"}${c.assentos.length ? ` · assento ${c.assentos.join(", ")}` : ""}`,
    );
  if (c.hoteis)
    linhas.push(
      `${c.hoteis} ${c.hoteis === 1 ? "hotel" : "hotéis"}${c.quartos.length ? ` · ${c.dependente ? c.pessoa : "você"} no ${c.quartos.join(", ")}` : ""}`,
    );
  const outros: string[] = [];
  if (c.trens) outros.push(`${c.trens} ${c.trens === 1 ? "trem/ônibus" : "trens/ônibus"}`);
  const porTipo = new Map<string, { n: number; papel: string | null }>();
  for (const r of c.reservas) {
    const x = porTipo.get(r.tipo) ?? { n: 0, papel: null };
    x.n++;
    if (r.papel) x.papel = r.papel;
    porTipo.set(r.tipo, x);
  }
  for (const [t, x] of porTipo)
    outros.push(`${x.n} ${NOME_RES[t] ?? t}${x.papel ? ` (${x.papel})` : ""}`);
  if (outros.length) linhas.push(outros.join(" · "));
  return linhas;
}

export function ConvitesRecebidos() {
  const qc = useQueryClient();
  const { data: convites = [] } = useQuery(convitesQuery());
  const { data: confianca = [] } = useQuery(confiancaQuery());
  const [confiar, setConfiar] = useState<Record<string, boolean>>({});
  if (convites.length === 0) return null;

  async function responder(c: ConviteRecebido, aceitar: boolean) {
    naTela<ConviteRecebido>(qc, convitesQuery().queryKey, (l) =>
      l.filter((x) => x.member_id !== c.member_id),
    );
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;
      const agora = new Date().toISOString();
      const ops: Parameters<typeof enviar>[0] = [
        {
          tipo: "update",
          tabela: "trip_member",
          id: c.member_id,
          valores: { status: aceitar ? "aceito" : "recusado", respondido_em: agora },
        },
      ];
      const ligado = confiar[c.organizador_id] ?? false;
      if (aceitar && ligado && uid)
        ops.push({
          tipo: "upsert",
          tabela: "trip_trust",
          onConflict: "account_id,organizer_id",
          valores: {
            account_id: uid,
            organizer_id: c.organizador_id,
            revogado_em: null,
            criado_em: agora,
          },
        });
      const r = await enviar(ops);
      toast.success(
        r === "fila"
          ? "Sem internet · resposta salva no aparelho"
          : aceitar
            ? `Você entrou em ${c.viagem}`
            : "Convite recusado",
      );
      void qc.invalidateQueries({ queryKey: tripsQuery().queryKey });
      void qc.invalidateQueries({ queryKey: confiancaQuery().queryKey });
    } catch (e) {
      naTela<ConviteRecebido>(qc, convitesQuery().queryKey, (l) => [...l, c]);
      toast.error((e as Error).message);
    }
  }

  return (
    <section aria-label="Convites recebidos" className="space-y-3">
      {convites.map((c) => {
        const jaConfia = confianca.some(
          (t) => t.organizer_id === c.organizador_id && !t.revogado_em,
        );
        return (
          <article
            key={c.member_id}
            className="shadow-soft rounded-[18px] border-2 border-accent bg-card p-5"
          >
            <p className="text-xl font-bold">
              {c.organizador} adicionou {c.dependente ? c.pessoa : "você"} a {c.viagem}
            </p>
            <p className="text-lg text-muted-foreground">
              {dataBRCurta(c.data_inicio)} a {dataBRCurta(c.data_fim)}
            </p>
            <ul className="mt-3 space-y-1 text-lg">
              {resumoConvite(c).map((l) => (
                <li key={l}>{l}</li>
              ))}
              {resumoConvite(c).length === 0 && <li>Ainda sem itens no seu nome.</li>}
            </ul>
            {!jaConfia && (
              <label className="mt-4 flex min-h-14 items-center gap-3 text-lg">
                <input
                  type="checkbox"
                  className="h-7 w-7 accent-[var(--accent)]"
                  checked={confiar[c.organizador_id] ?? false}
                  onChange={(e) =>
                    setConfiar((s) => ({ ...s, [c.organizador_id]: e.target.checked }))
                  }
                />
                <span>
                  Receber de {c.organizador} sem perguntar — próximas viagens entram direto
                </span>
              </label>
            )}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                onClick={() => void responder(c, false)}
                className="tap flex items-center justify-center gap-2 rounded-[18px] border-2 border-border text-lg font-bold"
              >
                <X size={24} /> Recusar
              </button>
              <button
                onClick={() => void responder(c, true)}
                className="tap flex items-center justify-center gap-2 rounded-[18px] bg-primary text-lg font-bold text-primary-foreground"
              >
                <Check size={24} /> Aceitar
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}

/** Lista "Recebo viagens direto de…" com opção de parar (tela Quem vê seus dados). */
export function ConfiancaViagens() {
  const qc = useQueryClient();
  const { data: confianca = [] } = useQuery(confiancaQuery());
  const ativos = confianca.filter((t) => !t.revogado_em);
  const { data: nomes = {} } = useQuery({
    queryKey: ["nomes_organizadores", ativos.map((t) => t.organizer_id).join(",")],
    enabled: ativos.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("person")
        .select("account_id, nome, apelido")
        .in(
          "account_id",
          ativos.map((t) => t.organizer_id),
        )
        .eq("kind", "self");
      return Object.fromEntries((data ?? []).map((p) => [p.account_id, p.apelido || p.nome]));
    },
  });
  if (ativos.length === 0) return null;
  async function parar(org: string, account: string) {
    naTela<(typeof confianca)[number]>(qc, confiancaQuery().queryKey, (l) =>
      l.map((t) => (t.organizer_id === org ? { ...t, revogado_em: new Date().toISOString() } : t)),
    );
    await mutar({
      tipo: "upsert",
      tabela: "trip_trust",
      onConflict: "account_id,organizer_id",
      valores: { account_id: account, organizer_id: org, revogado_em: new Date().toISOString() },
    }).catch((e) => toast.error((e as Error).message));
    toast("As próximas viagens vão pedir seu aceite.");
  }
  return (
    <section className="rounded-[18px] border border-border bg-card p-4">
      <h2 className="text-2xl">Recebo viagens direto de</h2>
      {ativos.map((t) => (
        <div
          key={t.organizer_id}
          className="flex items-center gap-3 border-t border-border py-2 first-of-type:border-0"
        >
          <span className="flex-1 text-lg font-bold">{nomes[t.organizer_id] ?? "Organizador"}</span>
          <button
            onClick={() => void parar(t.organizer_id, t.account_id)}
            className="tap px-3 text-lg font-bold text-destructive"
          >
            Parar
          </button>
        </div>
      ))}
    </section>
  );
}
