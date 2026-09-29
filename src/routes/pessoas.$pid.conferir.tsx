import { usuarioLocal } from "@/lib/sessao";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, Check, MessageSquareWarning } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Topo } from "@/components/Chrome";
import { AvatarPessoa } from "@/components/Pessoa";
import { Dado, NumeroOculto, VerFoto, dataBR } from "@/components/FichaPartes";
import { inputCls } from "@/components/Form";
import { fichaQuery, type Ficha, type MudancaRow } from "@/lib/pessoas";
import {
  NOME_DOC,
  NOME_SECAO,
  TIPOS_EXTRA,
  TIPOS_VISTO,
  passosDoModo,
  type Secao,
} from "@/lib/cadastro-tipos";
import { abrirWhatsApp } from "@/lib/links";

export const Route = createFileRoute("/pessoas/$pid/conferir")({
  head: () => ({
    meta: [
      { title: "Conferir ficha — Evoque Viagens" },
      { name: "description", content: "Aprovar cada parte do cadastro ou pedir correção." },
      { property: "og:title", content: "Conferir ficha — Evoque Viagens" },
      { property: "og:description", content: "Aprovar cada parte do cadastro ou pedir correção." },
    ],
  }),
  component: Conferir,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any };
const MOTIVOS = ["Foto escura", "Falta validade", "Foto cortada"];
const NOME_CAMPO: Record<string, string> = {
  apelido: "Apelido",
  cpf: "CPF",
  telefone: "WhatsApp",
  email: "E-mail",
  foto_url: "Foto",
  sexo: "Sexo",
  data_nascimento: "Nascimento",
  nome_como_no_documento: "Nome no passaporte",
  endereco: "Endereço",
  emergencia_nome: "Contato",
  emergencia_parentesco: "Parentesco",
  emergencia_telefone: "Telefone",
  numero: "Número",
  validade: "Validade",
  emissao: "Emissão",
  pais_emissor: "País",
  nome_no_documento: "Nome",
  detalhe: "Detalhe",
  arquivo_path: "Foto",
  tipo: "Novo documento",
  programa: "Novo programa",
  deleted_at: "Removido",
  assento: "Assento",
  quarto: "Quarto",
  bebe_alcool: "Bebe álcool",
  restricoes: "Comida",
  nacionalidades: "Nacionalidade",
};

type Decisao = { aprovado: boolean; corrigir: boolean; motivos: string[]; texto: string };

function Conferir() {
  const { pid } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: f } = useQuery(fichaQuery(pid));
  const [dec, setDec] = useState<Record<string, Decisao>>({});
  const [salvando, setSalvando] = useState(false);

  if (!f) return <p className="p-6 text-lg">Carregando…</p>;
  const p = f.pessoa;
  const temMudancas = f.mudancas.length > 0;
  const secoes: Secao[] = temMudancas
    ? Array.from(new Set(f.mudancas.map((m) => m.secao)))
    : passosDoModo(p.modo).filter(
        (s) => f.revisoes.find((r) => r.secao === s)?.status !== "aprovado",
      );

  const d = (s: string): Decisao =>
    dec[s] ?? { aprovado: false, corrigir: false, motivos: [], texto: "" };
  const set = (s: string, v: Partial<Decisao>) => setDec({ ...dec, [s]: { ...d(s), ...v } });
  const nAprovar = secoes.filter((s) => d(s).aprovado).length;
  const nDevolver = secoes.filter((s) => d(s).corrigir).length;

  async function concluir() {
    if (!navigator.onLine) return toast.error("Para conferir é preciso internet.");
    setSalvando(true);
    try {
      const { data: u } = await usuarioLocal();
      const agora = new Date().toISOString();
      const devolvidas: { secao: Secao; recado: string }[] = [];
      for (const s of secoes) {
        const x = d(s);
        if (!x.aprovado && !x.corrigir) continue;
        const recado = [...x.motivos, x.texto.trim()].filter(Boolean).join(" · ") || null;
        await db
          .from("person_section_review")
          .upsert(
            {
              person_id: pid,
              secao: s,
              status: x.aprovado ? "aprovado" : "correcao",
              recado: x.aprovado ? null : recado,
              revisado_por: u.user?.email,
              revisado_em: agora,
            },
            { onConflict: "person_id,secao" },
          );
        const mud = f!.mudancas.filter((m) => m.secao === s);
        if (mud.length) {
          if (!x.aprovado) await reverter(mud);
          await db
            .from("person_change")
            .update({ status: x.aprovado ? "aprovado" : "recusado" })
            .in(
              "id",
              mud.map((m) => m.id),
            );
        }
        if (x.corrigir) devolvidas.push({ secao: s, recado: recado ?? "" });
      }
      // Status geral
      const { data: revs } = await db
        .from("person_section_review")
        .select("secao, status")
        .eq("person_id", pid);
      const obrig = passosDoModo(p.modo);
      const todas = obrig.every(
        (s) =>
          (revs ?? []).find((r: { secao: string; status: string }) => r.secao === s)?.status !==
          "correcao",
      );
      const aprovadas = (revs ?? []).filter(
        (r: { status: string }) => r.status === "aprovado",
      ).length;
      const novo = devolvidas.length ? "correcao" : todas && aprovadas > 0 ? "aprovado" : p.status;
      await db.from("person").update({ status: novo }).eq("id", pid);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["pessoas"] }),
        qc.invalidateQueries({ queryKey: ["ficha", pid] }),
      ]);

      if (devolvidas.length) {
        // Correção acontece no WhatsApp: a pessoa responde lá e o admin atualiza a ficha. Sem link.
        const nome = p.apelido || p.nome.split(" ")[0];
        const recado = devolvidas
          .map(
            (x) =>
              `${NOME_SECAO[x.secao][p.idioma].toLowerCase()}: ${(x.recado || (p.idioma === "en" ? "please check" : "confira, por favor")).toLowerCase()}`,
          )
          .join("; ");
        const txt =
          p.idioma === "en"
            ? `Hi ${nome}! About your travel profile: ${recado}. Could you send it to me right here on WhatsApp?`
            : `Oi, ${nome}! Na sua ficha de viagem: ${recado}. Pode me mandar aqui mesmo pelo WhatsApp?`;
        abrirWhatsApp(p.telefone, txt);
      }
      toast.success("Conferência salva");
      navigate({ to: "/pessoas/$pid", params: { pid } });
    } catch {
      toast.error("Não deu certo agora. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  const rotuloBotao =
    nAprovar || nDevolver
      ? [nAprovar ? `Aprovar ${nAprovar}` : "", nDevolver ? `devolver ${nDevolver}` : ""]
          .filter(Boolean)
          .join(" · ")
      : "Marque as partes";

  return (
    <div className="min-h-screen bg-background pb-36">
      <Topo
        titulo={temMudancas ? "Conferir mudança" : "Conferir ficha"}
        voltarPara="/pessoas/$pid"
        voltarParams={{ pid }}
      />
      <main className="space-y-4 px-4 pt-4">
        <div className="flex items-center gap-4">
          <AvatarPessoa nome={p.nome} foto={p.foto_url} tamanho={64} />
          <p className="text-2xl font-bold text-foreground">{p.nome}</p>
        </div>
        {secoes.length === 0 && (
          <p className="text-lg text-muted-foreground">Nada para conferir agora.</p>
        )}
        {secoes.map((s) => {
          const x = d(s);
          return (
            <section key={s} className="shadow-soft rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <h2 className="flex-1 text-xl">{NOME_SECAO[s].pt}</h2>
                <button
                  aria-pressed={x.aprovado}
                  onClick={() => set(s, { aprovado: !x.aprovado, corrigir: false })}
                  className={`tap flex items-center gap-2 rounded-xl border-2 px-4 text-lg font-bold ${
                    x.aprovado
                      ? "border-ok bg-ok text-ok-foreground"
                      : "border-border text-foreground"
                  }`}
                >
                  <Check size={24} strokeWidth={2.2} />
                  {x.aprovado ? "Aprovado" : "Aprovar"}
                </button>
              </div>
              <div className="mt-2">
                {temMudancas ? (
                  <Mudancas lista={f.mudancas.filter((m) => m.secao === s)} />
                ) : (
                  <ConteudoSecao f={f} secao={s} />
                )}
              </div>
              {!x.corrigir ? (
                <button
                  onClick={() => set(s, { corrigir: true, aprovado: false })}
                  className="tap mt-3 flex items-center gap-2 rounded-xl px-2 text-base font-bold text-warn"
                >
                  <MessageSquareWarning size={22} strokeWidth={2.2} />
                  {temMudancas ? "Corrigir" : "Pedir correção"}
                </button>
              ) : (
                <div className="mt-3 space-y-2 rounded-xl bg-warn/10 p-3">
                  <div className="flex flex-wrap gap-2">
                    {MOTIVOS.map((m) => (
                      <button
                        key={m}
                        aria-pressed={x.motivos.includes(m)}
                        onClick={() =>
                          set(s, {
                            motivos: x.motivos.includes(m)
                              ? x.motivos.filter((y) => y !== m)
                              : [...x.motivos, m],
                          })
                        }
                        className={`tap rounded-full border-2 px-4 text-base font-bold ${
                          x.motivos.includes(m)
                            ? "border-warn bg-warn text-warn-foreground"
                            : "border-border bg-card text-foreground"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <input
                    aria-label="Recado"
                    placeholder="Recado (opcional)"
                    value={x.texto}
                    onChange={(e) => set(s, { texto: e.target.value })}
                    className={inputCls}
                  />
                  <button
                    onClick={() => set(s, { corrigir: false, motivos: [], texto: "" })}
                    className="tap text-base font-bold text-muted-foreground underline"
                  >
                    Cancelar correção
                  </button>
                </div>
              )}
            </section>
          );
        })}
        {temMudancas && (
          <p className="text-center text-base text-muted-foreground">
            O resto da ficha continua igual.
          </p>
        )}
      </main>
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button
          disabled={salvando || (!nAprovar && !nDevolver)}
          onClick={concluir}
          className="gradient-hero shadow-medium tap flex w-full items-center justify-center rounded-2xl text-xl font-bold disabled:opacity-60"
        >
          {salvando ? "Salvando…" : rotuloBotao}
        </button>
      </div>
    </div>
  );
}

async function reverter(mud: MudancaRow[]) {
  for (const m of mud) {
    const [tabela, id, coluna] = m.campo.split(":");
    if (!tabela || !id || !coluna) continue;
    const antigo = m.arquivo_antigo ?? m.valor_antigo;
    if (coluna === "tipo" || coluna === "programa") {
      await db.from(tabela).update({ deleted_at: new Date().toISOString() }).eq("id", id);
    } else if (coluna === "deleted_at") {
      await db.from(tabela).update({ deleted_at: null }).eq("id", id);
    } else if (tabela === "person_preferences") {
      const v =
        coluna === "restricoes"
          ? antigo
            ? antigo.split(", ")
            : []
          : coluna === "bebe_alcool"
            ? antigo == null
              ? null
              : antigo === "true"
            : antigo;
      await db
        .from(tabela)
        .update({ [coluna]: v })
        .eq("person_id", id);
    } else {
      const v = coluna === "nacionalidades" ? (antigo ? antigo.split(", ") : []) : antigo;
      await db
        .from(tabela)
        .update({ [coluna]: v })
        .eq("id", id);
    }
  }
}

function Mudancas({ lista }: { lista: MudancaRow[] }) {
  return (
    <div className="space-y-3">
      {lista.map((m) => {
        const coluna = m.campo.split(":")[2] ?? m.campo;
        const rot = NOME_CAMPO[coluna] ?? coluna;
        if (m.arquivo_antigo || m.arquivo_novo) {
          return (
            <div key={m.id}>
              <p className="text-base font-bold text-foreground">{rot}</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-sm text-muted-foreground">Antes</p>
                  {m.arquivo_antigo ? (
                    <VerFoto path={m.arquivo_antigo} rotulo="Foto antiga" />
                  ) : (
                    <p>—</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-ok">Nova</p>
                  {m.arquivo_novo ? <VerFoto path={m.arquivo_novo} rotulo="Foto nova" /> : <p>—</p>}
                </div>
              </div>
            </div>
          );
        }
        return (
          <div
            key={m.id}
            className="flex flex-wrap items-center gap-2 border-b border-border py-2 last:border-0"
          >
            <span className="w-full text-base text-muted-foreground">{rot}</span>
            <span className="text-lg text-muted-foreground line-through">
              {m.valor_antigo || "—"}
            </span>
            <ArrowRight size={20} strokeWidth={2.2} aria-hidden />
            <span className="text-lg font-bold text-ok">{m.valor_novo || "—"}</span>
          </div>
        );
      })}
    </div>
  );
}

function ConteudoSecao({ f, secao }: { f: Ficha; secao: Secao }) {
  const p = f.pessoa;
  const docsDe = (tipos: readonly string[]) => f.docs.filter((d) => tipos.includes(d.tipo));
  const listaDocs = (tipos: readonly string[]) => {
    const ds = docsDe(tipos);
    if (!ds.length) return <p className="text-base text-muted-foreground">Não tem.</p>;
    return ds.map((d) => (
      <div key={d.id} className="mb-3">
        <p className="text-lg font-bold text-foreground">{NOME_DOC[d.tipo]}</p>
        {d.nome_no_documento && <Dado rotulo="Nome" valor={d.nome_no_documento} />}
        {d.numero && <Dado rotulo="Número" valor={<NumeroOculto numero={d.numero} />} />}
        {d.pais_emissor && <Dado rotulo="País" valor={d.pais_emissor} />}
        {d.sexo && <Dado rotulo="Sexo" valor={d.sexo} />}
        {d.detalhe && <Dado rotulo="Detalhe" valor={d.detalhe} />}
        <Dado rotulo="Validade" valor={dataBR(d.validade)} />
        <VerFoto path={d.arquivo_path} />
      </div>
    ));
  };
  switch (secao) {
    case "voce":
      return (
        <>
          <VerFoto path={p.foto_url} rotulo="Ver foto da pessoa" />
          <Dado rotulo="Apelido" valor={p.apelido} />
          <Dado rotulo="CPF" valor={<NumeroOculto numero={p.cpf} />} />
          <Dado rotulo="WhatsApp" valor={p.telefone} />
          <Dado rotulo="E-mail" valor={p.email} />
        </>
      );
    case "passaporte":
      return (
        <>
          <Dado rotulo="Nascimento" valor={dataBR(p.data_nascimento)} />
          {listaDocs(["passaporte"])}
        </>
      );
    case "extras":
      return (
        <>
          {p.endereco && <Dado rotulo="Endereço" valor={p.endereco} />}
          {listaDocs(TIPOS_EXTRA)}
        </>
      );
    case "vistos":
      return <>{listaDocs(TIPOS_VISTO)}</>;
    case "fidelidade":
      return f.contas.length ? (
        <>
          {f.contas.map((c) => (
            <Dado key={c.id} rotulo={c.programa} valor={c.numero} />
          ))}
        </>
      ) : (
        <p className="text-base text-muted-foreground">Não tem.</p>
      );
    case "preferencias":
      return (
        <>
          <Dado rotulo="Assento" valor={f.prefs?.assento} />
          <Dado rotulo="Quarto" valor={f.prefs?.quarto} />
          <Dado
            rotulo="Bebe álcool"
            valor={f.prefs?.bebe_alcool == null ? null : f.prefs.bebe_alcool ? "Sim" : "Não"}
          />
          <Dado rotulo="Comida" valor={f.prefs?.restricoes.join(", ")} />
        </>
      );
    case "emergencia":
      return (
        <>
          <Dado rotulo="Nome" valor={p.emergencia_nome} />
          <Dado rotulo="Parentesco" valor={p.emergencia_parentesco} />
          <Dado rotulo="Telefone" valor={p.emergencia_telefone} />
        </>
      );
  }
}
