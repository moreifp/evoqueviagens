import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Camera, ChevronRight, FilePlus2, LockKeyhole, LogOut, Plus, Share2, UserPlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AvatarPessoa } from "./Pessoa";
import { euQuery, mascararFinal, nomeDocumento, progressoFicha, statusDocumento, type EuDados } from "@/lib/eu";
import { dataBR } from "./FichaPartes";
import { AvisosMeus, PedidosRecebidos } from "./AvisosPedidos";
import { AvisosPush } from "./AvisosPush";
import { EmOrdem } from "./EmOrdem";
import { FichaCompleta } from "./FichaCompleta";
import { entryRulesQuery, ticketsQuery, tripsQuery } from "@/lib/data";
import { conferir, regraPassaporte, type Conferencia } from "@/lib/conferencia";
import { carregarAeroportos, porIata } from "@/lib/aeroportos";
import { TIPOS_VISTO } from "@/lib/cadastro-tipos";

const STATUS = { ok: "bg-ok text-ok-foreground", warn: "bg-warn text-warn-foreground", danger: "bg-danger text-danger-foreground", muted: "bg-muted text-muted-foreground" } as const;
const LISTA_VAZIA: never[] = [];

export function EuDashboard({ personId, back = false }: { personId: string; back?: boolean }) {
  const { data, isLoading, error } = useQuery(euQuery(personId));
  if (isLoading) return <p className="p-6 text-lg text-muted-foreground">Carregando seus dados…</p>;
  if (error || !data) return <p className="p-6 text-lg text-danger">{error?.message ?? "Não foi possível abrir seus dados."}</p>;
  return <EuDashboardConteudo personId={personId} back={back} data={data} />;
}

function EuDashboardConteudo({ personId, back, data }: { personId: string; back: boolean; data: EuDados }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [addingDependent, setAddingDependent] = useState(false);
  const [dependentName, setDependentName] = useState("");
  const { data: viagens = LISTA_VAZIA } = useQuery(tripsQuery());
  const { data: regras = LISTA_VAZIA } = useQuery(entryRulesQuery());

  const { pessoa: p } = data;
  const owner = p.account_id === data.uid;
  const self = owner && p.kind === "self";
  const progresso = progressoFicha(data);
  const faltas = progresso.itens.filter((item) => !item.done && !item.dispensado).sort((a, b) => Number(b.obrigatorio) - Number(a.obrigatorio));
  const quemVe = data.compartilhamentos.filter((grant) => grant.owner_id === data.uid);
  const hoje = new Date().toISOString().slice(0, 10);
  const limite90 = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
  const proxima = [...viagens].filter((v) => !v.arquivada_em && v.data_fim >= hoje && v.data_inicio <= limite90).sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))[0] ?? null;
  const { data: bilhetes = LISTA_VAZIA } = useQuery({ ...ticketsQuery(proxima?.id ?? ""), enabled: Boolean(proxima) });
  const [paises, setPaises] = useState<string[]>([]);
  useEffect(() => {
    if (!proxima) { setPaises([]); return; }
    void carregarAeroportos().then((aeroportos) => setPaises([...new Set(bilhetes.map((b) => b.destino_iata ? porIata(aeroportos, b.destino_iata)?.pais : null).filter((pais): pais is string => Boolean(pais) && pais !== "BR"))]));
  }, [bilhetes, proxima?.id]);
  const viagemResumo = useMemo(() => {
    if (!proxima) return null;
    const passaporte = data.documentos.filter((d) => d.tipo === "passaporte").sort((a, b) => String(b.validade).localeCompare(String(a.validade)))[0];
    const c: Conferencia = {
      member_id: personId, person_id: personId, nome: p.nome, kind: p.kind, status: "aceito", papel: "member", acesso: true, meu: true,
      nacionalidades: p.nacionalidades, nome_documento: p.nome_como_no_documento,
      passaporte: passaporte ? { validade: passaporte.validade, nome: passaporte.nome_no_documento, pais: passaporte.pais_emissor } : null,
      vistos: data.documentos.filter((d) => (TIPOS_VISTO as readonly string[]).includes(d.tipo)).map((d) => ({ tipo: d.tipo, validade: d.validade })),
      vacina: data.documentos.find((d) => d.tipo === "vacina")?.validade ?? null,
      seguro: data.documentos.find((d) => d.tipo === "seguro")?.validade ?? null,
      nomes_bilhete: bilhetes.flatMap((b) => b.passageiros.filter((x) => x.person_id === personId).map((x) => x.nome_no_bilhete).filter((x): x is string => Boolean(x))),
      convite_telefone: null, convite_email: null, pedido_aberto: false, avisos_abertos: 0,
    };
    const ajuste = (proxima as unknown as { regra_passaporte?: { meses?: number; base?: string } | null }).regra_passaporte ?? null;
    const resultado = conferir(c, proxima, proxima.destino || proxima.nome, paises, regraPassaporte(proxima, paises, ajuste), regras);
    const campos = new Set(resultado.achados.filter((a) => a.nivel !== "ok" && a.campo).map((a) => a.campo));
    return { id: proxima.id, destino: proxima.cidades?.[0] || proxima.destino || proxima.nome, data: proxima.data_inicio, atencao: campos.size };
  }, [bilhetes, data.documentos, paises, p.kind, p.nacionalidades, p.nome, p.nome_como_no_documento, personId, proxima, regras]);

  async function sair() {
    // Apaga o token de avisos deste aparelho antes de sair.
    try {
      const { tokenSalvo, esquecerToken } = await import("@/lib/push");
      const token = tokenSalvo();
      if (token) {
        const { removerAparelho } = await import("@/lib/push.functions");
        await removerAparelho({ data: { token } }).catch(() => {});
        esquecerToken();
      }
    } catch {
      /* segue com a saída mesmo assim */
    }
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/" });
  }

  async function addDependent() {
    if (!dependentName.trim()) return;
    const { error: insertError } = await supabase.from("person").insert({ nome: dependentName.trim(), apelido: dependentName.trim().split(/\s+/)[0], kind: "dependent", status: "em_andamento" });
    if (insertError) return;
    setDependentName(""); setAddingDependent(false);
    await qc.invalidateQueries({ queryKey: ["eu", personId] });
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="flex items-center gap-3 px-4 py-3">
        {back && <button onClick={() => history.back()} className="tap text-lg font-bold text-foreground">Voltar</button>}
        <h1 className="min-w-0 flex-1 truncate text-3xl">{self ? "Minha conta" : p.apelido || p.nome}</h1>
        {self && (
          <Link to="/compartilhamentos" className="tap flex items-center gap-2 rounded-lg bg-primary px-4 text-lg font-bold text-primary-foreground">
            <Share2 size={26} strokeWidth={2.2} /> Compartilhar
          </Link>
        )}
      </header>

      <main className="mx-auto max-w-3xl space-y-7 px-4">
        {!owner && <p className="rounded-lg border-2 border-accent bg-card p-3 text-lg font-semibold">Compartilhado com você · só leitura</p>}

        <section className="gradient-hero shadow-medium rounded-lg p-5">
          <div className="flex items-center gap-4">
            <AvatarPessoa nome={p.nome} foto={p.foto_url} tamanho={76} />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-2xl">{p.nome}</h2>
              <p className="truncate text-base opacity-90">{p.email ?? "E-mail não informado"}</p>
            </div>
          </div>
          <progress value={progresso.percentual} max={100} aria-label={`Ficha ${progresso.percentual}% completa`} className="mt-5 h-3 w-full overflow-hidden rounded-full accent-current" />
          <p className="mt-2 text-lg font-bold">Sua ficha está {progresso.percentual}% completa · {progresso.feitos} de {progresso.total}</p>
          {owner && faltas.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{faltas.map((item) => <button type="button" key={item.id} onClick={() => navigate({ href: item.href })} className="tap flex items-center rounded-full bg-background px-4 text-base font-bold text-foreground">+ {item.label}</button>)}</div>}
        </section>

        {data.documentos.length > 0 && <EmOrdem personId={p.id} documentos={data.documentos} owner={owner} viagem={viagemResumo} dependentes={owner ? data.dependentes.map((pessoa) => ({ pessoa, documentos: data.documentosDependentes[pessoa.id] ?? [] })) : []} />}

        <FichaCompleta personId={p.id} itens={progresso.itens} owner={owner} />

        {self && <AvisosMeus />}
        {self && <PedidosRecebidos />}
        {self && <AvisosPush />}

        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-2xl">Documentos</h2>{owner && <Link to="/pessoas/$pid/documentos/novo" params={{ pid: p.id }} search={{ tipo: "", did: "" }} className="tap flex items-center gap-2 text-lg font-bold text-accent"><Plus size={24} /> Adicionar</Link>}</div>
          <div className="space-y-3">
            {data.documentos.map((doc) => {
              const st = statusDocumento(doc);
              const count = data.anexos.filter((a) => a.document_id === doc.id).length || (doc.arquivo_path ? 1 : 0);
              if (doc.tipo === "passaporte") return (
                <Link key={doc.id} to="/pessoas/$pid/documentos/$did" params={{ pid: p.id, did: doc.id }} className="block rounded-lg bg-primary p-5 text-primary-foreground shadow-medium">
                  <div className="flex items-center justify-between"><span className="text-base font-bold">PASSAPORTE · {doc.pais_emissor ?? "PAÍS"}</span><span className={`rounded-full px-3 py-1 text-sm font-bold ${STATUS[st.tone]}`}>{st.label}</span></div>
                  <p className="mono-code mt-5 text-2xl">{mascararFinal(doc.numero)}</p>
                  <div className="mt-4 flex justify-between text-base"><span>Validade {dataBR(doc.validade)}</span><span>{count} {count === 1 ? "anexo" : "anexos"}</span></div>
                </Link>
              );
              return <Link key={doc.id} to="/pessoas/$pid/documentos/$did" params={{ pid: p.id, did: doc.id }} className="tap flex items-center gap-3 border-b border-border py-3"><span className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-base font-bold">{doc.tipo.slice(0, 3).toUpperCase()}</span><span className="min-w-0 flex-1"><strong className="block text-lg">{nomeDocumento(doc.tipo)}</strong><span className="block text-base text-muted-foreground">{mascararFinal(doc.numero)} · {count} {count === 1 ? "anexo" : "anexos"}</span></span><ChevronRight size={26} /></Link>;
            })}
            {!data.documentos.length && (owner ? <Link to="/pessoas/$pid/documentos/novo" params={{ pid: p.id }} search={{ tipo: "", did: "" }} className="tap flex min-h-24 items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border text-lg font-bold"><Camera size={28} /> Fotografar seu primeiro documento</Link> : <p className="text-lg text-muted-foreground">Nenhum documento.</p>)}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-2xl">Fidelidade</h2><Link to="/pessoas/$pid/fidelidade" params={{ pid: p.id }} className="tap flex items-center text-lg font-bold text-accent">Ver todos ({data.fidelidades.length})</Link></div>
          {!data.fidelidades.length && owner && <Link to="/pessoas/$pid/fidelidade/novo" params={{ pid: p.id }} className="tap flex min-h-24 items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border text-lg font-bold"><Plus size={28} /> Adicionar programa de fidelidade</Link>}<div className="divide-y divide-border">{data.fidelidades.slice(0, 3).map((item) => <Link key={item.id} to="/pessoas/$pid/fidelidade/$fid" params={{ pid: p.id, fid: item.id }} className="tap flex items-center gap-3 py-3"><span className="flex h-14 w-14 items-center justify-center rounded-lg bg-secondary text-base font-bold">{item.programa.slice(0, 2).toUpperCase()}</span><span className="min-w-0 flex-1"><strong className="block truncate text-lg">{item.programa}</strong><span className="text-base text-muted-foreground">{mascararFinal(item.numero)}{item.categoria ? ` · ${item.categoria}` : ""}</span></span>{owner && <LockKeyhole size={22} className="text-muted-foreground" />}<ChevronRight size={26} /></Link>)}</div>
        </section>

        {owner && (
          <section>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-2xl">Família</h2><button onClick={() => setAddingDependent((value) => !value)} className="tap flex items-center gap-2 text-lg font-bold text-accent"><UserPlus size={24} /> Dependente</button></div>
            {addingDependent && <div className="mb-3 flex gap-2"><input value={dependentName} onChange={(event) => setDependentName(event.target.value)} placeholder="Nome do dependente" className="tap min-w-0 flex-1 rounded-lg border-2 border-input bg-card px-4 text-lg" /><button onClick={() => void addDependent()} className="tap rounded-lg bg-primary px-4 text-lg font-bold text-primary-foreground">Adicionar</button></div>}
            {!data.dependentes.length && !addingDependent && <button onClick={() => setAddingDependent(true)} className="tap flex min-h-24 w-full items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border text-lg font-bold"><UserPlus size={28} /> Adicionar dependente</button>}<div className="space-y-2">{data.dependentes.map((dep) => <Link key={dep.id} to="/pessoas/$pid" params={{ pid: dep.id }} className="tap flex items-center gap-3 rounded-lg border border-border bg-card p-3"><AvatarPessoa nome={dep.nome} foto={dep.foto_url} /><strong className="flex-1 text-lg">{dep.nome}</strong><ChevronRight size={26} /></Link>)}</div>
          </section>
        )}

        <section><h2 className="mb-3 text-2xl">Mais sobre você</h2><div className="divide-y divide-border rounded-lg border border-border bg-card px-4">
          <Link to="/pessoas/$pid/dados" params={{ pid: p.id }} search={{ secao: "preferencias" }} className="tap flex items-center py-3"><span className="flex-1"><strong className="block text-lg">Preferências</strong><span className="text-base text-muted-foreground">{data.preferencias ? [data.preferencias.assento, data.preferencias.quarto, data.preferencias.restricoes.length ? data.preferencias.restricoes.join(", ") : "sem restrição"].filter(Boolean).join(" · ") : "Falta preencher"}</span></span><ChevronRight size={26} /></Link>
          <Link to="/pessoas/$pid/dados" params={{ pid: p.id }} search={{ secao: "emergencia" }} className="tap flex items-center py-3"><span className="flex-1"><strong className="block text-lg">Contato de emergência</strong><span className={`text-base ${p.emergencia_nome ? "text-muted-foreground" : "text-warn"}`}>{p.emergencia_nome ? `${p.emergencia_nome} · ${p.emergencia_telefone ?? "sem telefone"}` : "Falta preencher"}</span></span><ChevronRight size={26} /></Link>
          <Link to="/pessoas/$pid/dados" params={{ pid: p.id }} search={{ secao: "pessoais" }} className="tap flex items-center py-3"><span className="flex-1"><strong className="block text-lg">Dados pessoais</strong><span className="text-base text-muted-foreground">Nome, CPF, nascimento, contato e endereço</span></span><ChevronRight size={26} /></Link>
        </div></section>

        {self && <Link to="/compartilhamentos" className="tap flex items-center gap-3 rounded-lg border border-border bg-card p-4"><Users size={28} /><span className="flex-1"><strong className="block text-lg">Quem vê seus dados</strong><span className="text-base text-muted-foreground">Você compartilha com {quemVe.length} {quemVe.length === 1 ? "pessoa" : "pessoas"}</span></span><ChevronRight size={26} /></Link>}

        {self && <button onClick={sair} className="tap flex w-full items-center justify-center gap-2 border-t border-border text-lg font-bold text-destructive"><LogOut size={26} /> Sair da conta</button>}
        {owner && !self && <Link to="/pessoas/$pid/documentos/novo" params={{ pid: p.id }} search={{ tipo: "", did: "" }} className="gradient-hero tap flex items-center justify-center gap-2 rounded-lg text-lg font-bold"><FilePlus2 size={26} /> Adicionar documento</Link>}
      </main>
    </div>
  );
}