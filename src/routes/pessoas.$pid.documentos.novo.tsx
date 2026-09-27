import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AlertTriangle, FileImage, FileUp, CheckCircle2, Keyboard, Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Topo } from "@/components/Chrome";
import { Campo, inputCls } from "@/components/Form";
import { ACEITA_QUALQUER, DicaArrastar, Miniatura, TirarFoto, ZonaArquivo, previaDe } from "@/components/ArquivoFoto";
import { euQuery, nomeDocumento } from "@/lib/eu";
import { blobParaDataUrl, melhorarDocumentoParaOcr, prepararArquivo } from "@/lib/imagem";
import { pdfParaImagem } from "@/lib/pdf";
import { conferirDatasCNH, escolherRegistro, validaRegistroCNH } from "@/lib/cnh";
import { identificarDocumentoAdmin, lerDocumentoAdmin, lerPassaporteAdmin } from "@/lib/cadastro.functions";
import { supabase } from "@/integrations/supabase/client";
import { nomePais3 } from "@/lib/paises3";
import { salvarDadosPessoaPassaporte } from "@/lib/passaportePessoa";

const TIPOS = [["passaporte", "Passaporte"], ["rg", "RG"], ["cnh", "CNH e PID"], ["visto", "Visto ou ESTA"], ["vacina", "Vacina"], ["seguro", "Seguro"], ["global_entry", "Global Entry"], ["outro", "Outro"]] as const;

export const Route = createFileRoute("/pessoas/$pid/documentos/novo")({
  validateSearch: (search: Record<string, unknown>) => ({ tipo: typeof search.tipo === "string" ? search.tipo : "", did: typeof search.did === "string" ? search.did : "" }),
  head: () => ({ meta: [
    { title: "Adicionar documento — Evoque Viagens" }, { name: "description", content: "Fotografe, confira e salve seu documento de viagem." },
    { property: "og:title", content: "Adicionar documento — Evoque Viagens" }, { property: "og:description", content: "Leitura assistida e conferência de documentos." },
  ] }), component: NovoDocumento,
});

function NovoDocumento() {
  const { pid } = Route.useParams(); const search = Route.useSearch(); const nav = useNavigate(); const qc = useQueryClient();
  const { data } = useQuery(euQuery(pid)); const identify = useServerFn(identificarDocumentoAdmin); const readDoc = useServerFn(lerDocumentoAdmin); const readPassport = useServerFn(lerPassaporteAdmin);
  const [manual, setManual] = useState(false); const [tipo, setTipo] = useState(search.tipo || ""); const [file, setFile] = useState<File | null>(null); const [fields, setFields] = useState<Record<string, string>>({}); const [reading, setReading] = useState(false); const [readState, setReadState] = useState<"idle" | "ok" | "fail">("idle"); const [saving, setSaving] = useState(false); const [regFalhou, setRegFalhou] = useState(false); const editDoc = data?.documentos.find((doc) => doc.id === search.did);
  useEffect(() => { if (!editDoc) return; setTipo(editDoc.tipo); setFields((old) => ({ ...old, nome_no_documento: editDoc.nome_no_documento ?? "", numero: editDoc.numero ?? "", pais_emissor: editDoc.pais_emissor ?? "", sexo: editDoc.sexo ?? "", detalhe: editDoc.detalhe ?? "", emissao: editDoc.emissao ?? "", validade: editDoc.validade ?? "", primeira_habilitacao: editDoc.primeira_habilitacao ?? "", local_expedicao: editDoc.local_expedicao ?? "" })); }, [editDoc?.id]);
  useEffect(() => { if (!data) return; setFields((old) => ({ ...old, nascimento: old.nascimento || data.pessoa.data_nascimento || "", nacionalidade: old.nacionalidade || data.pessoa.nacionalidades[0] || "" })); }, [data?.pessoa.id]);
  if (!data) return <p className="p-6 text-lg">Carregando…</p>;
  const owner = data.pessoa.account_id === data.uid;
  const ehCnh = tipo === "cnh";
  const numeroCnhInvalido = ehCnh && !!fields.numero && !validaRegistroCNH(fields.numero);
  const suspeitos = new Set<string>(ehCnh ? conferirDatasCNH(fields) : []);
  if (numeroCnhInvalido || (ehCnh && regFalhou && !fields.numero)) suspeitos.add("numero");
  const precisaConfirmar = readState === "ok" && suspeitos.size > 0;

  async function receive(next: File, forced?: string) {
    setFile(next); setReading(true); setReadState("idle"); setRegFalhou(false);
    try {
      const prepared = await prepararArquivo(next, 2200);
      // Arquivos que não são foto nem PDF (eml, doc, xls…) só anexam, sem leitura.
      if (prepared.ext !== "jpg" && prepared.ext !== "heic" && prepared.ext !== "pdf") { setTipo(forced || tipo || "outro"); setReadState("fail"); return; }
      // PDF: as 2 primeiras páginas viram imagem no aparelho; o PDF original é o anexo.
      const origem = prepared.ext === "pdf" ? await pdfParaImagem(next) : prepared.blob;
      const enhanced = await melhorarDocumentoParaOcr(origem); const image = await blobParaDataUrl(enhanced);
      let detected = forced || tipo; if (!detected) { const r = await identify({ data: { imagem: image } }); detected = r.ok ? r.tipo : "outro"; setTipo(detected); }
      if (detected === "passaporte") { const r = await readPassport({ data: { imagem: image } }); if (r.ok) { const lido: Record<string, string> = { numero: r.mrz.numero ?? "", pais_emissor: r.mrz.paisEmissor || r.mrz.nacionalidade || "", nome_no_documento: r.mrz.nomeCompleto ?? "", sexo: r.mrz.sexo ?? "", validade: r.mrz.validade ?? "", emissao: r.emissao ?? "", nascimento: r.mrz.nascimento ?? "", nacionalidade: r.mrz.nacionalidade ?? "" }; setFields((old) => { const n = { ...old }; for (const [k, v] of Object.entries(lido)) if (v && !n[k]) n[k] = v; return n; }); } else throw new Error(); }
      else {
        const r = await readDoc({ data: { imagem: image, tipo: detected } }); if (!r.ok) throw new Error();
        const { data_nascimento, ...resto } = r.campos;
        const lido: Record<string, string> = Object.fromEntries(Object.entries(resto).filter(([, v]) => v).map(([k, v]) => [k, String(v)]));
        if (detected === "cnh") {
          const reg = escolherRegistro(r.campos.numero, r.cnh?.numeros_11 ?? [], data!.pessoa.cpf || r.cnh?.cpf);
          lido.numero = reg ?? ""; setRegFalhou(!reg);
          // Sem data de emissão: fica vazia (nunca copiar a 1ª habilitação).
          if (!r.campos.emissao) lido.emissao = "";
        }
        setFields((old) => ({ ...old, ...lido, nascimento: old.nascimento || data_nascimento || "" }));
      }
      setReadState("ok");
    } catch { setReadState("fail"); } finally { setReading(false); }
  }

  async function save(form: FormData) {
    if (!owner || !tipo) return; setSaving(true);
    let passo = "Não deu para salvar os dados do documento.";
    try {
      const id = editDoc?.id ?? crypto.randomUUID(); const values = { person_id: pid, tipo, numero: String(form.get("numero") || "") || null, nome_no_documento: String(form.get("nome_no_documento") || "") || null, pais_emissor: String(form.get("pais_emissor") || "") || null, sexo: String(form.get("sexo") || "") || null, detalhe: String(form.get("detalhe") || "") || null, emissao: String(form.get("emissao") || "") || null, validade: String(form.get("validade") || "") || null, primeira_habilitacao: ehCnh ? String(form.get("primeira_habilitacao") || "") || null : (editDoc?.primeira_habilitacao ?? null), local_expedicao: ehCnh ? String(form.get("local_expedicao") || "") || null : (editDoc?.local_expedicao ?? null) };
      if (editDoc) { const changed = Object.fromEntries(Object.entries(values).filter(([key, value]) => key !== "person_id" && value !== (editDoc[key as keyof typeof editDoc] ?? null))) as Partial<typeof values>; if (Object.keys(changed).length) { const updated = await supabase.from("traveler_document").update(changed).eq("id", id); if (updated.error) throw updated.error; } } else { const inserted = await supabase.from("traveler_document").insert({ id, ...values }); if (inserted.error) throw inserted.error; }
      passo = "Os dados foram salvos, mas não deu para atualizar a ficha (nascimento/nacionalidade).";
      if (tipo === "passaporte") await salvarDadosPessoaPassaporte(data!.pessoa, { nascimento: String(form.get("nascimento") || ""), nacionalidade: String(form.get("nacionalidade") || ""), nome: values.nome_no_documento });
      if (file) {
        passo = "Os dados foram salvos, mas não deu para enviar a foto.";
        const prepared = await prepararArquivo(file); const path = `${pid}/docs/${id}/${crypto.randomUUID()}.${prepared.ext}`;
        const uploaded = await supabase.storage.from("documentos").upload(path, prepared.blob, { contentType: prepared.contentType }); if (uploaded.error) throw uploaded.error;
        try {
          // A foto anterior continua como anexo, só deixa de ser a principal.
          const demote = await supabase.from("document_attachment").update({ is_primary: false }).eq("document_id", id).eq("is_primary", true).is("deleted_at", null); if (demote.error) throw demote.error;
          const attachment = await supabase.from("document_attachment").insert({ document_id: id, person_id: pid, storage_path: path, file_name: file.name || `documento.${prepared.ext}`, content_type: prepared.contentType, size_bytes: prepared.blob.size, is_primary: true }); if (attachment.error) throw attachment.error;
        } catch (e) { await supabase.storage.from("documentos").remove([path]); throw e; }
        await supabase.from("traveler_document").update({ arquivo_path: path }).eq("id", id);
      }
      await qc.invalidateQueries({ queryKey: ["eu", pid] }); await qc.invalidateQueries({ queryKey: ["documento", pid, id] }); toast.success(`${nomeDocumento(tipo)} salvo`); nav({ to: "/pessoas/$pid/documentos/$did", params: { pid, did: id } });
    } catch { toast.error(passo); setSaving(false); }
  }

  const campos: [string, string, string][] = [['nome_no_documento','Nome no documento','text'],['numero','Número','text'],['pais_emissor','País emissor','text'],['sexo','Sexo','text'],['detalhe','Detalhe','text'],['emissao','Emissão','date'],['validade','Validade','date']];
  if (ehCnh) campos.splice(5, 0, ['local_expedicao','Local de expedição','text'], ['primeira_habilitacao','1ª habilitação','date']);
  const ambar = (k: string) => (suspeitos.has(k) && (readState === "ok" || k === "numero") ? " border-warn ring-2 ring-warn" : "");

  return <div className="min-h-screen bg-background pb-20"><Topo titulo={editDoc ? `Editar ${nomeDocumento(editDoc.tipo)}` : "Adicionar documento"} voltarPara="/pessoas/$pid" voltarParams={{ pid }} /><main className="mx-auto max-w-xl space-y-5 px-4 pt-5">
    {!file && !manual && <><TirarFoto onFoto={(f) => void receive(f)} rotulo={editDoc ? "Tirar nova foto" : "Fotografar documento"} sub={editDoc ? "A foto atual permanece se você não escolher outra." : "Foto ou PDF. A gente lê os dados, você só confere."} className="gradient-hero shadow-medium min-h-24 w-full py-6 text-xl font-bold" /><div className="grid grid-cols-2 gap-3"><ZonaArquivo aceita="image/*,.heic,.heif" onArquivo={(f) => void receive(f)} className="tap flex flex-col items-center justify-center rounded-lg border-2 border-border text-lg font-bold"><FileImage size={28} /> Foto da galeria</ZonaArquivo><ZonaArquivo aceita={ACEITA_QUALQUER} colar onArquivo={(f) => void receive(f)} className="tap flex flex-col items-center justify-center rounded-lg border-2 border-border text-lg font-bold"><FileUp size={28} /> Arquivo ou PDF</ZonaArquivo></div><DicaArrastar />{!editDoc && <button type="button" onClick={() => { setManual(true); if (!tipo) setTipo("outro"); }} className="tap flex w-full items-center justify-center gap-2 rounded-lg border-2 border-border text-lg font-bold"><Keyboard size={26} /> Não tenho foto · digitar os dados</button>}</>}
    {!tipo && <section><h2 className="mb-3 text-2xl">Ou escolha o tipo</h2><div className="grid grid-cols-3 gap-2">{TIPOS.map(([id, label]) => <button key={id} onClick={() => setTipo(id)} className="tap rounded-lg border-2 border-border p-2 text-base font-bold">{label}</button>)}</div></section>}
    {(file || editDoc || manual) && <form action={(fd) => void save(fd)} className="space-y-4">{file && <div className="rounded-lg border border-border bg-card p-3"><Miniatura src={previaDe(file)} className="h-40 w-full rounded-lg" /><p className="mt-3 flex items-center gap-2 text-lg font-bold">{reading ? <><Loader2 size={24} className="animate-spin" /> Lendo…</> : readState === "ok" ? precisaConfirmar ? <><AlertTriangle size={24} className="text-warn" /> Lemos a foto · confira os campos em destaque</> : <><CheckCircle2 size={24} className="text-ok" /> Lemos a foto · confira</> : readState === "fail" ? "Não deu para ler" : null}</p><div className="flex flex-wrap gap-4">{readState === "fail" && !reading && <button type="button" onClick={() => void receive(file, tipo || undefined)} className="tap inline-flex items-center gap-2 text-lg font-bold text-accent"><RotateCw size={22} /> Tentar ler de novo</button>}<button type="button" onClick={() => { setFile(null); setReadState("idle"); }} className="tap text-lg font-bold text-accent">Trocar arquivo</button></div></div>}{manual && !file && <button type="button" onClick={() => setManual(false)} className="tap text-lg font-bold text-accent">Usar foto em vez de digitar</button>}
      <Campo rotulo="Tipo"><select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>{TIPOS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Campo>
      {campos.map(([key,label,input]) => <Campo key={key} rotulo={(ROTULOS[tipo] ?? {})[key] ?? label}><input name={key} type={input} max={input === "date" ? "2099-12-31" : undefined} inputMode={ehCnh && key === "numero" ? "numeric" : undefined} maxLength={ehCnh && key === "numero" ? 11 : undefined} placeholder={ehCnh && key === "numero" && regFalhou && !fields.numero ? "Não deu para ler o nº de registro · digite" : undefined} value={fields[key] ?? ""} onChange={(e) => setFields((old) => ({ ...old, [key]: ehCnh && key === "numero" ? e.target.value.replace(/\D/g, "") : e.target.value }))} className={inputCls + ambar(key)} />{ehCnh && key === "numero" && fields.numero && <p className={`mt-1 text-base font-bold ${numeroCnhInvalido ? "text-warn" : "text-ok"}`}>{numeroCnhInvalido ? (fields.numero.length < 11 ? `${fields.numero.length} de 11 dígitos` : "Número não confere · verifique") : "Número confere"}</p>}</Campo>)}
      {tipo === "passaporte" && <><Campo rotulo="Data de nascimento"><input name="nascimento" type="date" max="2099-12-31" value={fields.nascimento ?? ""} onChange={(e) => setFields((o) => ({ ...o, nascimento: e.target.value }))} className={inputCls} /></Campo><Campo rotulo={`Nacionalidade${fields.nacionalidade ? ` · ${nomePais3(fields.nacionalidade)}` : ""}`}><input name="nacionalidade" type="text" maxLength={3} placeholder="BRA" autoCapitalize="characters" value={fields.nacionalidade ?? ""} onChange={(e) => setFields((o) => ({ ...o, nacionalidade: e.target.value.toUpperCase() }))} className={inputCls} /></Campo></>}
      {precisaConfirmar && <p className="rounded-lg border-2 border-warn p-3 text-lg">Algumas datas ou o número não conferem. Confira os campos em destaque antes de confirmar.</p>}
      <button disabled={saving || reading || !owner} className="gradient-hero tap w-full rounded-lg text-xl font-bold">{readState === "ok" ? "Confirmar" : `Salvar ${nomeDocumento(tipo)}`}</button>
    </form>}
  </main></div>;
}
/** Rótulos específicos por tipo de documento (mesmo formulário). */
const ROTULOS: Record<string, Record<string, string>> = {
  cnh: { numero: "Nº de registro", detalhe: "Categoria (CAT. HAB.)", emissao: "Data de emissão", validade: "Validade" },
  seguro: { nome_no_documento: "Seguradora", numero: "Apólice", detalhe: "Telefone de emergência da seguradora", emissao: "Início", validade: "Fim da cobertura" },
  global_entry: { numero: "Known Traveler Number (KTN)", detalhe: "Programa (Global Entry / TSA PreCheck)" },
  vacina: { detalhe: "Vacina e dose", emissao: "Data da vacina" },
  outra_vacina: { detalhe: "Qual vacina", emissao: "Data da vacina" },
};
