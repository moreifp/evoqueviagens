import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, ClipboardCheck, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Topo } from "@/components/Chrome";
import { AvatarPessoa, LinhaStatus } from "@/components/Pessoa";
import { Cartao, Dado, Editor, NumeroOculto, VerFoto, dataBR, type CampoEd } from "@/components/FichaPartes";
import { alertaDoc, fichaQuery, pessoasQuery, situacao, type Ficha } from "@/lib/pessoas";
import { mutar } from "@/lib/outbox";
import { comprimir } from "@/lib/imagem";
import { NOME_DOC, TIPOS_VISTO } from "@/lib/cadastro-tipos";
import { abrirWhatsApp, linkDaPessoa, urlDoLink } from "@/lib/links";

export const Route = createFileRoute("/pessoas/$pid/")({
  head: () => ({
    meta: [
      { title: "Ficha — Evoque Viagens" },
      { name: "description", content: "Ficha de viagem da pessoa: documentos, vistos, fidelidade e emergência." },
      { property: "og:title", content: "Ficha — Evoque Viagens" },
      { property: "og:description", content: "Ficha de viagem da pessoa." },
    ],
  }),
  component: FichaPessoa,
});

const CAMPOS_VOCE: CampoEd[] = [
  { chave: "nome", rotulo: "Nome" },
  { chave: "apelido", rotulo: "Como gosta de ser chamado(a)" },
  { chave: "nome_como_no_documento", rotulo: "Nome como no passaporte" },
  { chave: "data_nascimento", rotulo: "Nascimento", tipo: "date" },
  { chave: "sexo", rotulo: "Sexo (como no passaporte)", opcoes: [["M", "M"], ["F", "F"], ["X", "X"]] },
  { chave: "cpf", rotulo: "CPF" },
  { chave: "telefone", rotulo: "WhatsApp", tipo: "tel" },
  { chave: "email", rotulo: "E-mail", tipo: "email" },
  { chave: "endereco", rotulo: "Endereço" },
];
const SEXO: [string, string][] = [["M", "M"], ["F", "F"], ["X", "X"]];
function camposDoDoc(tipo: string): CampoEd[] {
  const base: CampoEd[] = [
    { chave: "nome_no_documento", rotulo: "Nome no documento" },
    { chave: "numero", rotulo: "Número" },
    { chave: "pais_emissor", rotulo: "País / nacionalidade" },
  ];
  if (tipo === "passaporte") base.push({ chave: "sexo", rotulo: "Sexo", opcoes: SEXO });
  base.push(
    { chave: "detalhe", rotulo: (TIPOS_VISTO as readonly string[]).includes(tipo) ? "Tipo de visto (ex.: B1/B2)" : "Detalhe" },
    { chave: "emissao", rotulo: "Emissão", tipo: "date" },
    { chave: "validade", rotulo: "Validade", tipo: "date" },
  );
  return base;
}
const CAMPOS_EMERG: CampoEd[] = [
  { chave: "emergencia_nome", rotulo: "Nome" },
  { chave: "emergencia_parentesco", rotulo: "Parentesco" },
  { chave: "emergencia_telefone", rotulo: "Telefone", tipo: "tel" },
];
const CAMPOS_PREF: CampoEd[] = [
  { chave: "assento", rotulo: "Assento", opcoes: [["janela", "Janela"], ["corredor", "Corredor"], ["tanto_faz", "Tanto faz"]] },
  { chave: "quarto", rotulo: "Quarto", opcoes: [["casal", "Casal"], ["duas_camas", "2 camas"], ["tanto_faz", "Tanto faz"]] },
  { chave: "bebe_alcool", rotulo: "Bebe álcool?", opcoes: [["true", "Sim"], ["false", "Não"]] },
  { chave: "restricoes", rotulo: "Comida (separe por vírgula)" },
];
const NOME_ASSENTO: Record<string, string> = { janela: "Janela", corredor: "Corredor", tanto_faz: "Tanto faz" };
const NOME_QUARTO: Record<string, string> = { casal: "Casal", duas_camas: "2 camas", tanto_faz: "Tanto faz" };

function FichaPessoa() {
  const { pid } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: f, isLoading } = useQuery(fichaQuery(pid));
  const { data: lista } = useQuery(pessoasQuery());
  const [editando, setEditando] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  if (isLoading) return <p className="p-6 text-lg">Carregando…</p>;
  if (!f) return <p className="p-6 text-lg">Ficha não guardada neste aparelho.</p>;
  const p = f.pessoa;
  const s = lista ? situacao(p, lista.docs, lista.mudancas, lista.links) : null;

  function patch(fn: (x: Ficha) => Ficha) {
    qc.setQueryData(fichaQuery(pid).queryKey, (x: Ficha | undefined) => (x ? fn(x) : x));
  }
  async function salvarOp(op: Parameters<typeof mutar>[0]) {
    try {
      const r = await mutar(op);
      if (r === "fila") toast("Sem internet · salvo no aparelho");
      else qc.invalidateQueries({ queryKey: ["pessoas"] });
    } catch {
      toast.error("Não deu para salvar. Confira os dados.");
    }
  }

  function salvarPessoa(v: Record<string, string | null>) {
    if (Object.keys(v).length === 0) return setEditando(null);
    patch((x) => ({ ...x, pessoa: { ...x.pessoa, ...v } }));
    setEditando(null);
    salvarOp({ tipo: "update", tabela: "person", id: pid, valores: v });
  }

  function apagarDoc(id: string, nome: string) {
    const doc = f!.docs.find((d) => d.id === id)!;
    patch((x) => ({ ...x, docs: x.docs.filter((d) => d.id !== id) }));
    salvarOp({ tipo: "update", tabela: "traveler_document", id, valores: { deleted_at: new Date().toISOString() } });
    toast(`${nome} apagado`, {
      duration: 10000,
      action: {
        label: "Desfazer",
        onClick: () => {
          patch((x) => ({ ...x, docs: [...x.docs, doc] }));
          salvarOp({ tipo: "update", tabela: "traveler_document", id, valores: { deleted_at: null } });
        },
      },
    });
  }

  function apagarConta(id: string, nome: string) {
    const c = f!.contas.find((d) => d.id === id)!;
    patch((x) => ({ ...x, contas: x.contas.filter((d) => d.id !== id) }));
    salvarOp({ tipo: "update", tabela: "loyalty_account", id, valores: { deleted_at: new Date().toISOString() } });
    toast(`${nome} apagado`, {
      duration: 10000,
      action: {
        label: "Desfazer",
        onClick: () => {
          patch((x) => ({ ...x, contas: [...x.contas, c] }));
          salvarOp({ tipo: "update", tabela: "loyalty_account", id, valores: { deleted_at: null } });
        },
      },
    });
  }

  async function pedirNovo(secao: string, nomeDoc: string) {
    try {
      const token = await linkDaPessoa(pid);
      const nome = p.apelido || p.nome.split(" ")[0];
      const txt =
        p.idioma === "en"
          ? `Hi ${nome}! Your ${nomeDoc} is expiring soon. Could you send the new one here? ${urlDoLink(token, secao)}`
          : `Oi, ${nome}! Seu ${nomeDoc} está perto de vencer. Pode mandar o novo por aqui? ${urlDoLink(token, secao)}`;
      abrirWhatsApp(p.telefone, txt);
    } catch {
      toast.error("Sem internet agora. Tente quando conectar.");
    }
  }

  async function apagarPessoa() {
    if (!navigator.onLine) return toast.error("Para apagar as fotos é preciso internet.");
    const { data: arquivos } = await supabase.storage.from("documentos").list(pid, { limit: 1000 });
    if (arquivos?.length) await supabase.storage.from("documentos").remove(arquivos.map((a) => `${pid}/${a.name}`));
    await mutar({ tipo: "update", tabela: "person", id: pid, valores: { deleted_at: new Date().toISOString(), foto_url: null } });
    await qc.invalidateQueries({ queryKey: ["pessoas"] });
    toast.success(`${p.nome} apagado`);
    navigate({ to: "/" });
  }

  const passaportes = f.docs.filter((d) => d.tipo === "passaporte");
  const vistos = f.docs.filter((d) => (TIPOS_VISTO as readonly string[]).includes(d.tipo));
  const extras = f.docs.filter((d) => d.tipo !== "passaporte" && !(TIPOS_VISTO as readonly string[]).includes(d.tipo));

  function cartaoDoc(d: Ficha["docs"][number]) {
    const nome = NOME_DOC[d.tipo] ?? d.tipo;
    const a = alertaDoc(d);
    const secao = d.tipo === "passaporte" ? "passaporte" : (TIPOS_VISTO as readonly string[]).includes(d.tipo) ? "vistos" : "extras";
    const chave = `doc:${d.id}`;
    return (
      <Cartao key={d.id} titulo={nome} onEditar={() => setEditando(chave)} onApagar={() => apagarDoc(d.id, nome)}>
        {editando === chave ? (
          <Editor
            campos={camposDoDoc(d.tipo)}
            valores={d}
            foto={{ path: d.arquivo_path }}
            onCancelar={() => setEditando(null)}
            onSalvar={async (v, novaFoto) => {
              const valores: Record<string, string | null> = { ...v };
              if (novaFoto !== undefined) {
                if (!navigator.onLine) {
                  toast.error("Trocar a foto só com internet. O resto foi salvo.");
                } else if (novaFoto === null) {
                  valores.arquivo_path = null;
                  if (d.arquivo_path) await supabase.storage.from("documentos").remove([d.arquivo_path]);
                } else {
                  const path = `${pid}/${d.tipo}-${crypto.randomUUID()}.jpg`;
                  const { error } = await supabase.storage.from("documentos").upload(path, await comprimir(novaFoto), { contentType: "image/jpeg" });
                  if (error) toast.error("A foto nova não subiu. O resto foi salvo.");
                  else valores.arquivo_path = path;
                }
              }
              setEditando(null);
              if (Object.keys(valores).length === 0) return;
              patch((x) => ({ ...x, docs: x.docs.map((y) => (y.id === d.id ? { ...y, ...valores } : y)) }));
              salvarOp({ tipo: "update", tabela: "traveler_document", id: d.id, valores });
            }}
          />
        ) : (
          <>
            {d.nome_no_documento && <Dado rotulo="Nome" valor={d.nome_no_documento} />}
            <Dado rotulo="Número" valor={<NumeroOculto numero={d.numero} />} />
            {d.pais_emissor && <Dado rotulo="País" valor={d.pais_emissor} />}
            {d.detalhe && <Dado rotulo="Detalhe" valor={d.detalhe} />}
            <Dado rotulo="Validade" valor={dataBR(d.validade)} />
            {a && (
              <div className={`mt-2 flex items-center gap-2 rounded-xl p-3 ${a.nivel === "danger" ? "bg-danger/10 text-danger" : "bg-warn/10 text-warn"}`}>
                <AlertTriangle size={24} strokeWidth={2.2} />
                <span className="flex-1 text-base font-bold">{a.texto}</span>
                <button
                  onClick={() => pedirNovo(secao, nome)}
                  className="tap flex items-center gap-1 rounded-xl border-2 border-current px-3 text-base font-bold"
                >
                  <Send size={20} strokeWidth={2.2} />
                  Pedir novo
                </button>
              </div>
            )}
            <VerFoto path={d.arquivo_path} />
          </>
        )}
      </Cartao>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <Topo titulo={p.apelido || p.nome} voltarPara="/" />
      <main className="space-y-4 px-4 pt-4">
        <div className="flex items-center gap-4">
          <AvatarPessoa nome={p.nome} foto={p.foto_url} tamanho={72} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-2xl font-bold text-foreground">{p.nome}</p>
            {s && <LinhaStatus nivel={s.nivel} texto={s.texto} />}
          </div>
        </div>
        {s?.aprovar && (
          <Link
            to="/pessoas/$pid/conferir"
            params={{ pid }}
            className="gradient-hero shadow-medium tap flex items-center justify-center gap-2 rounded-2xl text-xl font-bold"
          >
            <ClipboardCheck size={26} strokeWidth={2.2} />
            Conferir
          </Link>
        )}

        <Cartao titulo="Você" onEditar={() => setEditando("voce")}>
          {editando === "voce" ? (
            <Editor campos={CAMPOS_VOCE} valores={p} onCancelar={() => setEditando(null)} onSalvar={salvarPessoa} />
          ) : (
            <>
              <Dado rotulo="Nome no passaporte" valor={p.nome_como_no_documento} />
              <Dado rotulo="Nascimento" valor={dataBR(p.data_nascimento)} />
              <Dado rotulo="Sexo" valor={p.sexo} />
              <Dado rotulo="Nacionalidade" valor={p.nacionalidades.join(", ")} />
              <Dado rotulo="CPF" valor={<NumeroOculto numero={p.cpf} />} />
              <Dado rotulo="WhatsApp" valor={p.telefone} />
              <Dado rotulo="E-mail" valor={p.email} />
              {p.endereco && <Dado rotulo="Endereço" valor={p.endereco} />}
            </>
          )}
        </Cartao>

        {passaportes.length === 0 && (
          <Cartao titulo="Passaporte">
            <p className="text-base text-muted-foreground">Ainda não enviado.</p>
          </Cartao>
        )}
        {passaportes.map((d) => cartaoDoc(d))}
        {vistos.map((d) => cartaoDoc(d))}

        {f.contas.map((c) => (
          <Cartao key={c.id} titulo={c.programa} onEditar={() => setEditando(`conta:${c.id}`)} onApagar={() => apagarConta(c.id, c.programa)}>
            {editando === `conta:${c.id}` ? (
              <Editor
                campos={[
                  { chave: "numero", rotulo: "Número" },
                  { chave: "categoria", rotulo: "Categoria (ex.: Gold)" },
                ]}
                valores={c}
                onCancelar={() => setEditando(null)}
                onSalvar={(v) => {
                  setEditando(null);
                  if (Object.keys(v).length === 0) return;
                  patch((x) => ({ ...x, contas: x.contas.map((y) => (y.id === c.id ? { ...y, ...v } : y)) }));
                  setEditando(null);
                  salvarOp({ tipo: "update", tabela: "loyalty_account", id: c.id, valores: v });
                }}
              />
            ) : (
              <>
                <Dado rotulo="Número" valor={c.numero} />
                {c.categoria && <Dado rotulo="Categoria" valor={c.categoria} />}
              </>
            )}
          </Cartao>
        ))}

        <Cartao titulo="Preferências" onEditar={() => setEditando("pref")}>
          {editando === "pref" ? (
            <Editor
              campos={CAMPOS_PREF}
              valores={{
                ...f.prefs,
                bebe_alcool: f.prefs?.bebe_alcool == null ? "" : String(f.prefs.bebe_alcool),
                restricoes: f.prefs?.restricoes.join(", ") ?? "",
              }}
              onCancelar={() => setEditando(null)}
              onSalvar={(v) => {
                if (Object.keys(v).length === 0) return setEditando(null);
                const at = f.prefs;
                const valores = {
                  person_id: pid,
                  assento: "assento" in v ? v.assento : at?.assento ?? null,
                  quarto: "quarto" in v ? v.quarto : at?.quarto ?? null,
                  bebe_alcool: "bebe_alcool" in v ? (v.bebe_alcool == null ? null : v.bebe_alcool === "true") : at?.bebe_alcool ?? null,
                  restricoes:
                    "restricoes" in v ? (v.restricoes ?? "").split(",").map((x) => x.trim()).filter(Boolean) : at?.restricoes ?? [],
                };
                patch((x) => ({ ...x, prefs: valores }));
                setEditando(null);
                salvarOp({ tipo: "upsert", tabela: "person_preferences", valores, onConflict: "person_id" });
              }}
            />
          ) : (
            <>
              <Dado rotulo="Assento" valor={NOME_ASSENTO[f.prefs?.assento ?? ""]} />
              <Dado rotulo="Quarto" valor={NOME_QUARTO[f.prefs?.quarto ?? ""]} />
              <Dado rotulo="Bebe álcool" valor={f.prefs?.bebe_alcool == null ? null : f.prefs.bebe_alcool ? "Sim" : "Não"} />
              <Dado rotulo="Comida" valor={f.prefs?.restricoes.join(", ")} />
            </>
          )}
        </Cartao>

        <Cartao titulo="Emergência" onEditar={() => setEditando("emerg")}>
          {editando === "emerg" ? (
            <Editor campos={CAMPOS_EMERG} valores={p} onCancelar={() => setEditando(null)} onSalvar={salvarPessoa} />
          ) : (
            <>
              <Dado rotulo="Nome" valor={p.emergencia_nome} />
              <Dado rotulo="Parentesco" valor={p.emergencia_parentesco} />
              <Dado rotulo="Telefone" valor={p.emergencia_telefone} />
            </>
          )}
        </Cartao>

        {extras.map((d) => cartaoDoc(d))}

        <div className="pt-6">
          {!confirmar ? (
            <button
              onClick={() => setConfirmar(true)}
              className="tap flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-destructive text-lg font-bold text-destructive"
            >
              <Trash2 size={24} strokeWidth={2.2} />
              Apagar {p.apelido || p.nome} e as fotos
            </button>
          ) : (
            <div className="space-y-3 rounded-2xl border-2 border-destructive p-4">
              <p className="text-lg font-bold text-foreground">Apagar a ficha e todas as fotos de {p.nome}?</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmar(false)} className="tap flex-1 rounded-xl border-2 border-border text-lg font-bold text-foreground">
                  Cancelar
                </button>
                <button onClick={apagarPessoa} className="tap flex-1 rounded-xl bg-destructive text-lg font-bold text-destructive-foreground">
                  Sim, apagar
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
