import { abrirAnexo, urlDoAnexo } from "@/lib/anexosOffline";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Copy,
  Download,
  Eye,
  EyeOff,
  FilePlus2,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Topo } from "@/components/Chrome";
import { ACEITA_QUALQUER, DicaArrastar, TirarFoto, ZonaArquivo } from "@/components/ArquivoFoto";
import {
  documentoQuery,
  mascararFinal,
  nomeDoc,
  statusDocumento,
  type AnexoDocumento,
} from "@/lib/eu";
import { dataBR } from "@/components/FichaPartes";
import { prepararArquivo } from "@/lib/imagem";
import { supabase } from "@/integrations/supabase/client";
import { mutar } from "@/lib/outbox";
import { useServerFn } from "@tanstack/react-start";
import { ScanLine, Loader2 } from "lucide-react";
import { lerPassaporteAdmin } from "@/lib/cadastro.functions";
import { blobParaDataUrl, LADO_DOC_IA, melhorarDocumentoParaOcr } from "@/lib/imagem";
import { pdfParaImagem } from "@/lib/pdf";
import { nomePais3 } from "@/lib/paises3";
import { salvarDadosPessoaPassaporte } from "@/lib/passaportePessoa";

type Proposta = { chave: string; rotulo: string; valor: string; mostrar: string };

export const Route = createFileRoute("/pessoas/$pid/documentos/$did")({
  head: () => ({
    meta: [
      { title: "Documento — Viagens Organizadas" },
      { name: "description", content: "Dados e anexos do seu documento." },
      { property: "og:title", content: "Documento — Viagens Organizadas" },
      { property: "og:description", content: "Documento pessoal guardado com segurança." },
    ],
  }),
  component: Documento,
});

function Documento() {
  const { pid, did } = Route.useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data } = useQuery(documentoQuery(pid, did));
  const [revealed, setRevealed] = useState(false);
  const [full, setFull] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const readPassport = useServerFn(lerPassaporteAdmin);
  const [relendo, setRelendo] = useState(false);
  const [propostas, setPropostas] = useState<Proposta[] | null>(null);
  const [aplicando, setAplicando] = useState(false);
  useEffect(() => {
    if (!data) return;
    let alive = true;
    void Promise.all(
      data.anexos.map(async (a) => [a.storage_path, await urlDoAnexo(a.storage_path)] as const),
    ).then((pares) => {
      if (alive)
        setUrls(Object.fromEntries(pares.filter((x): x is readonly [string, string] => !!x[1])));
    });
    return () => {
      alive = false;
    };
  }, [data]);
  if (!data) return <p className="p-6 text-lg">Carregando…</p>;
  const doc = data.documento;
  const owner = data.pessoa.account_id === data.uid;
  const st = statusDocumento(doc);
  const primary = data.anexos.find((a) => a.is_primary) ?? data.anexos[0];
  const sees = data.compartilhamentos.filter(
    (g) => g.owner_id === data.uid && g.blocos.includes("documentos"),
  );

  async function add(file: File) {
    if (!owner || !navigator.onLine) return toast.error("Para anexar, conecte à internet.");
    try {
      const prep = await prepararArquivo(file);
      const path = `${pid}/docs/${did}/${crypto.randomUUID()}.${prep.ext}`;
      const up = await supabase.storage
        .from("documentos")
        .upload(path, prep.blob, { contentType: prep.contentType });
      if (up.error) throw up.error;
      const ins = await supabase
        .from("document_attachment")
        .insert({
          document_id: did,
          person_id: pid,
          storage_path: path,
          file_name: file.name || `arquivo.${prep.ext}`,
          content_type: prep.contentType,
          size_bytes: prep.blob.size,
          is_primary: (data?.anexos.length ?? 0) === 0,
        });
      if (ins.error) {
        await supabase.storage.from("documentos").remove([path]);
        throw ins.error;
      }
      await qc.invalidateQueries({ queryKey: ["documento", pid, did] });
      await qc.invalidateQueries({ queryKey: ["eu", pid] });
      toast.success("Anexo adicionado");
    } catch {
      toast.error("Não foi possível anexar o arquivo.");
    }
  }
  async function remove() {
    if (!owner) return;
    const now = new Date().toISOString();
    await mutar({
      tipo: "update",
      tabela: "traveler_document",
      id: did,
      valores: { deleted_at: now },
    });
    await qc.invalidateQueries({ queryKey: ["eu", pid] });
    toast(`${nomeDoc(doc)} apagado`, {
      duration: 10000,
      action: {
        label: "Desfazer",
        onClick: () => {
          void mutar({
            tipo: "update",
            tabela: "traveler_document",
            id: did,
            valores: { deleted_at: null },
          });
          void qc.invalidateQueries({ queryKey: ["eu", pid] });
        },
      },
    });
    nav({ to: "/pessoas/$pid", params: { pid } });
  }
  async function reler() {
    const url = primary && urls[primary.storage_path];
    if (
      !url ||
      !(primary?.content_type.startsWith("image/") || primary?.content_type === "application/pdf")
    )
      return;
    if (!navigator.onLine) return toast.error("Precisa de internet para ler a foto.");
    setRelendo(true);
    setPropostas(null);
    try {
      const blob = await (await fetch(url)).blob();
      const ehPdfArq =
        blob.type === "application/pdf" || /\.pdf$/i.test(primary?.storage_path ?? "");
      const fonte = ehPdfArq ? await pdfParaImagem(blob) : blob;
      const r = await readPassport({
        data: {
          imagem: await blobParaDataUrl(
            await melhorarDocumentoParaOcr(fonte, LADO_DOC_IA),
          ),
        },
      });
      if (!r.ok) throw new Error();
      const p = data!.pessoa;
      const m = r.mrz;
      const out: Proposta[] = [];
      const add = (
        chave: string,
        rotulo: string,
        atual: string | null | undefined,
        valor: string | null | undefined,
        mostrar?: string,
      ) => {
        if (!atual && valor) out.push({ chave, rotulo, valor, mostrar: mostrar ?? valor });
      };
      add("nome_no_documento", "Nome no documento", doc.nome_no_documento, m.nomeCompleto);
      add("numero", "Número", doc.numero, m.numero);
      add("pais_emissor", "País", doc.pais_emissor, m.paisEmissor);
      add("sexo", "Sexo", doc.sexo, m.sexo);
      add("validade", "Validade", doc.validade, m.validade, dataBR(m.validade) ?? undefined);
      add("emissao", "Emissão", doc.emissao, r.emissao, dataBR(r.emissao) ?? undefined);
      add(
        "nascimento",
        "Data de nascimento",
        p.data_nascimento,
        m.nascimento,
        dataBR(m.nascimento) ?? undefined,
      );
      add(
        "nacionalidade",
        "Nacionalidade",
        p.nacionalidades[0],
        m.nacionalidade,
        `${nomePais3(m.nacionalidade)} (${m.nacionalidade})`,
      );
      if (!out.length) toast("Nada novo para preencher.");
      else setPropostas(out);
    } catch {
      toast.error("Não conseguimos ler a foto.");
    } finally {
      setRelendo(false);
    }
  }
  async function aplicar() {
    if (!propostas) return;
    setAplicando(true);
    try {
      const v = Object.fromEntries(propostas.map((x) => [x.chave, x.valor]));
      const docUp: {
        nome_no_documento?: string;
        numero?: string;
        pais_emissor?: string;
        sexo?: string;
        validade?: string;
        emissao?: string;
      } = {};
      for (const k of [
        "nome_no_documento",
        "numero",
        "pais_emissor",
        "sexo",
        "validade",
        "emissao",
      ] as const)
        if (v[k]) docUp[k] = v[k]!;
      if (Object.keys(docUp).length) {
        const u = await supabase.from("traveler_document").update(docUp).eq("id", did);
        if (u.error) throw u.error;
      }
      await salvarDadosPessoaPassaporte(data!.pessoa, {
        nascimento: v.nascimento,
        nacionalidade: v.nacionalidade,
        nome: v.nome_no_documento ?? doc.nome_no_documento,
      });
      await qc.invalidateQueries({ queryKey: ["documento", pid, did] });
      await qc.invalidateQueries({ queryKey: ["eu", pid] });
      setPropostas(null);
      toast.success("Campos preenchidos");
    } catch {
      toast.error("Não foi possível salvar agora.");
    } finally {
      setAplicando(false);
    }
  }
  const field = (label: string, value: string | null, secret = false) => (
    <div className="border-b border-border py-3">
      <span className="block text-base font-bold text-muted-foreground">{label}</span>
      <span className="mt-1 flex items-center gap-2 text-lg">
        <span className="min-w-0 flex-1 break-words">
          {secret && !revealed ? mascararFinal(value) : value || "—"}
        </span>
        {secret && (
          <button
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Ocultar número" : "Revelar número"}
            className="tap"
          >
            {revealed ? <EyeOff size={24} /> : <Eye size={24} />}
          </button>
        )}{" "}
        {value && (
          <button
            onClick={() => {
              void navigator.clipboard.writeText(value);
              toast.success("Copiado");
            }}
            aria-label={`Copiar ${label}`}
            className="tap"
          >
            <Copy size={24} />
          </button>
        )}
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <Topo titulo={nomeDoc(doc)} voltarPara="/pessoas/$pid" voltarParams={{ pid }} />
      <main className="mx-auto max-w-2xl space-y-5 px-4 pt-5">
        <span
          className={`inline-flex rounded-full px-3 py-2 text-base font-bold ${st.tone === "ok" ? "bg-ok text-ok-foreground" : st.tone === "warn" ? "bg-warn text-warn-foreground" : st.tone === "danger" ? "bg-danger text-danger-foreground" : "bg-muted text-muted-foreground"}`}
        >
          {st.label}
        </span>
        {primary &&
          urls[primary.storage_path] &&
          (primary.content_type.startsWith("image/") ? (
            <button
              onClick={() => setFull(urls[primary.storage_path] ?? null)}
              className="block w-full"
            >
              <img
                src={urls[primary.storage_path]}
                alt={`Foto de ${nomeDoc(doc)}`}
                className="max-h-[55vh] w-full rounded-lg object-contain"
              />
            </button>
          ) : primary.content_type.includes("rfc822") || /\.eml$/i.test(primary.storage_path) ? (
            <button
              onClick={() => void abrirAnexo(primary.storage_path)}
              className="tap flex w-full items-center justify-center rounded-lg border-2 border-border text-lg font-bold"
            >
              <Download size={26} /> Abrir e-mail
            </button>
          ) : (
            <a
              href={urls[primary.storage_path]}
              target="_blank"
              rel="noreferrer"
              className="tap flex items-center justify-center rounded-lg border-2 border-border text-lg font-bold"
            >
              <Download size={26} />{" "}
              {primary.content_type.includes("pdf") ? "Abrir PDF" : "Abrir arquivo"}
            </a>
          ))}
        <section className="rounded-lg border border-border bg-card px-4">
          {field("Nome no documento", doc.nome_no_documento)}
          {field("Número", doc.numero, true)}
          <div className="grid grid-cols-2 gap-4">
            {field("Emissão", dataBR(doc.emissao))}
            {field("Validade", dataBR(doc.validade))}
            {field("País", doc.pais_emissor)}
            {field("Sexo", doc.sexo)}
          </div>
          {doc.tipo === "passaporte" && (
            <div className="grid grid-cols-2 gap-4">
              {field("Nascimento", dataBR(data.pessoa.data_nascimento))}
              {field(
                "Nacionalidade",
                data.pessoa.nacionalidades[0] ? nomePais3(data.pessoa.nacionalidades[0]) : null,
              )}
            </div>
          )}
          {doc.tipo === "cnh" && (
            <div className="grid grid-cols-2 gap-4">
              {field("Local", doc.local_expedicao ?? null)}
              {field("1ª habilitação", dataBR(doc.primeira_habilitacao ?? null))}
            </div>
          )}
          {field(
            doc.tipo === "cnh" ? "Categoria" : doc.tipo === "outro" ? "Detalhe 1" : "Detalhe",
            doc.detalhe,
          )}
          {doc.tipo === "outro" && field("Detalhe 2", doc.detalhe2 ?? null)}
        </section>
        {owner &&
          doc.tipo === "passaporte" &&
          (primary?.content_type.startsWith("image/") ||
            primary?.content_type === "application/pdf") &&
          !propostas && (
            <button
              onClick={() => void reler()}
              disabled={relendo}
              className="tap flex w-full items-center justify-center gap-2 rounded-lg border-2 border-primary text-lg font-bold disabled:opacity-60"
            >
              {relendo ? (
                <>
                  <Loader2 size={26} className="animate-spin" /> Lendo a foto…
                </>
              ) : (
                <>
                  <ScanLine size={26} /> Ler a foto de novo
                </>
              )}
            </button>
          )}
        {propostas && (
          <section className="rounded-lg border-2 border-accent bg-card p-4">
            <h2 className="text-2xl">Preencher campos vazios?</h2>
            <div className="mt-2">
              {propostas.map((x) => (
                <div key={x.chave} className="border-b border-border py-2">
                  <span className="block text-base font-bold text-muted-foreground">
                    {x.rotulo}
                  </span>
                  <span className="text-lg">{x.mostrar}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => setPropostas(null)}
                className="tap rounded-lg border-2 border-border text-lg font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={() => void aplicar()}
                disabled={aplicando}
                className="gradient-hero tap rounded-lg text-lg font-bold"
              >
                Preencher
              </button>
            </div>
          </section>
        )}
        <section>
          <h2 className="mb-3 text-2xl">Anexos</h2>
          <div className="space-y-2">
            {data.anexos.map((a: AnexoDocumento) =>
              a.content_type.includes("rfc822") || a.file_name.endsWith(".eml") ? (
                <button
                  key={a.id}
                  onClick={() => void abrirAnexo(a.storage_path)}
                  className="tap flex w-full items-center gap-3 border-b border-border py-2 text-left"
                >
                  <FilePlus2 size={26} />
                  <span className="min-w-0 flex-1 truncate text-lg">
                    {a.file_name}
                    {a.is_primary && (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-sm font-bold text-primary">
                        Original
                      </span>
                    )}
                  </span>
                  <span className="text-base text-muted-foreground">
                    E-mail ·{" "}
                    {a.size_bytes ? `${Math.max(1, Math.round(a.size_bytes / 1024))} KB` : "—"}
                  </span>
                  <Download size={24} />
                </button>
              ) : (
                <a
                  key={a.id}
                  href={urls[a.storage_path]}
                  target="_blank"
                  rel="noreferrer"
                  className="tap flex items-center gap-3 border-b border-border py-2"
                >
                  <FilePlus2 size={26} />
                  <span className="min-w-0 flex-1 truncate text-lg">
                    {a.file_name}
                    {a.is_primary && (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-sm font-bold text-primary">
                        Original
                      </span>
                    )}
                  </span>
                  <span className="text-base text-muted-foreground">
                    {a.content_type.includes("pdf")
                      ? "PDF"
                      : a.content_type.startsWith("image/")
                        ? "Foto"
                        : a.content_type.includes("rfc822") || a.file_name.endsWith(".eml")
                          ? "E-mail"
                          : "Arquivo"}{" "}
                    · {a.size_bytes ? `${Math.max(1, Math.round(a.size_bytes / 1024))} KB` : "—"}
                  </span>
                  <Download size={24} />
                </a>
              ),
            )}
          </div>
          {owner && (
            <div className="mt-3 grid gap-2">
              <ZonaArquivo
                aceita={ACEITA_QUALQUER}
                colar
                onArquivo={(f) => void add(f)}
                className="tap flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-lg font-bold"
              >
                <Plus size={26} /> Anexar arquivo
                <DicaArrastar />
              </ZonaArquivo>
              <TirarFoto onFoto={(f) => void add(f)} />
            </div>
          )}
        </section>
        <Link
          to="/compartilhamentos"
          className="tap flex items-center gap-3 rounded-lg border border-border bg-card p-4"
        >
          <Users size={26} />
          <span className="flex-1 text-lg">
            Quem vê: você
            {sees.length ? ` e ${sees.map((g) => g.grantee_nome ?? "alguém").join(", ")}` : ""}
          </span>
          <span className="font-bold text-accent">Mudar</span>
        </Link>
        {owner && (
          <div className="grid grid-cols-3 gap-2">
            <Link
              to="/pessoas/$pid/documentos/novo"
              params={{ pid }}
              search={{ tipo: doc.tipo, did: doc.id }}
              className="tap flex flex-col items-center justify-center rounded-lg border-2 border-border text-base font-bold"
            >
              <Pencil size={25} /> Editar
            </Link>
            <Link
              to="/pessoas/$pid/documentos/novo"
              params={{ pid }}
              search={{ tipo: doc.tipo, did: "" }}
              className="tap flex flex-col items-center justify-center rounded-lg border-2 border-border text-base font-bold"
            >
              <Plus size={25} /> Novo
            </Link>
            <button
              onClick={() => void remove()}
              className="tap flex flex-col items-center justify-center rounded-lg border-2 border-destructive text-base font-bold text-destructive"
            >
              <Trash2 size={25} /> Apagar
            </button>
          </div>
        )}
        {full && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-primary p-4"
            onClick={() => setFull(null)}
          >
            <button
              onClick={() => setFull(null)}
              aria-label="Fechar"
              className="fixed right-3 top-3 tap text-primary-foreground"
            >
              <X size={32} />
            </button>
            <img
              src={full}
              alt="Documento ampliado"
              className="min-w-full max-w-none object-contain"
            />
          </div>
        )}
      </main>
    </div>
  );
}
