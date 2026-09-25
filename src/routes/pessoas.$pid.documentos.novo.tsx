import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Camera, FileImage, FileUp, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Topo } from "@/components/Chrome";
import { Campo, inputCls } from "@/components/Form";
import { ACEITA_DOC, DicaArrastar, Miniatura, TirarFoto, ZonaArquivo, previaDe } from "@/components/ArquivoFoto";
import { euQuery, nomeDocumento } from "@/lib/eu";
import { blobParaDataUrl, melhorarDocumentoParaOcr, prepararArquivo } from "@/lib/imagem";
import { identificarDocumentoAdmin, lerDocumentoAdmin, lerPassaporteAdmin } from "@/lib/cadastro.functions";
import { supabase } from "@/integrations/supabase/client";

const TIPOS = [["passaporte", "Passaporte"], ["rg", "RG"], ["cnh", "CNH e PID"], ["visto", "Visto ou ESTA"], ["vacina", "Vacina"], ["seguro", "Seguro"], ["global_entry", "Global Entry"], ["outro", "Outro"]] as const;

export const Route = createFileRoute("/pessoas/$pid/documentos/novo")({
  validateSearch: (search: Record<string, unknown>) => ({ tipo: typeof search.tipo === "string" ? search.tipo : "" }),
  head: () => ({ meta: [
    { title: "Adicionar documento — Evoque Viagens" }, { name: "description", content: "Fotografe, confira e salve seu documento de viagem." },
    { property: "og:title", content: "Adicionar documento — Evoque Viagens" }, { property: "og:description", content: "Leitura assistida e conferência de documentos." },
  ] }), component: NovoDocumento,
});

function NovoDocumento() {
  const { pid } = Route.useParams(); const search = Route.useSearch(); const nav = useNavigate(); const qc = useQueryClient();
  const { data } = useQuery(euQuery(pid)); const identify = useServerFn(identificarDocumentoAdmin); const readDoc = useServerFn(lerDocumentoAdmin); const readPassport = useServerFn(lerPassaporteAdmin);
  const [tipo, setTipo] = useState(search.tipo || ""); const [file, setFile] = useState<File | null>(null); const [fields, setFields] = useState<Record<string, string>>({}); const [reading, setReading] = useState(false); const [readState, setReadState] = useState<"idle" | "ok" | "fail">("idle"); const [saving, setSaving] = useState(false);
  if (!data) return <p className="p-6 text-lg">Carregando…</p>;
  const owner = data.pessoa.account_id === data.uid;

  async function receive(next: File, forced?: string) {
    setFile(next); setReading(true); setReadState("idle");
    try {
      const prepared = await prepararArquivo(next, 2200); if (prepared.ext === "pdf") { setTipo(forced || tipo || "outro"); setReadState("fail"); return; }
      const enhanced = await melhorarDocumentoParaOcr(prepared.blob); const image = await blobParaDataUrl(enhanced);
      let detected = forced || tipo; if (!detected) { const r = await identify({ data: { imagem: image } }); detected = r.ok ? r.tipo : "outro"; setTipo(detected); }
      if (detected === "passaporte") { const r = await readPassport({ data: { imagem: image } }); if (r.ok) setFields({ numero: r.mrz.numero ?? "", pais_emissor: r.mrz.nacionalidade || r.mrz.paisEmissor || "", nome_no_documento: r.mrz.nomeCompleto ?? "", sexo: r.mrz.sexo ?? "", validade: r.mrz.validade ?? "", emissao: r.emissao ?? "" }); else throw new Error(); }
      else { const r = await readDoc({ data: { imagem: image, tipo: detected } }); if (r.ok) setFields(Object.fromEntries(Object.entries(r.campos).filter(([, v]) => v).map(([k, v]) => [k, String(v)]))); else throw new Error(); }
      setReadState("ok");
    } catch { setReadState("fail"); } finally { setReading(false); }
  }

  async function save(form: FormData) {
    if (!owner || !tipo) return; setSaving(true);
    try {
      const id = crypto.randomUUID(); const values = { id, person_id: pid, tipo, numero: String(form.get("numero") || "") || null, nome_no_documento: String(form.get("nome_no_documento") || "") || null, pais_emissor: String(form.get("pais_emissor") || "") || null, sexo: String(form.get("sexo") || "") || null, detalhe: String(form.get("detalhe") || "") || null, emissao: String(form.get("emissao") || "") || null, validade: String(form.get("validade") || "") || null };
      const inserted = await supabase.from("traveler_document").insert(values); if (inserted.error) throw inserted.error;
      if (file) {
        const prepared = await prepararArquivo(file); const path = `${pid}/docs/${id}/${crypto.randomUUID()}.${prepared.ext}`;
        const uploaded = await supabase.storage.from("documentos").upload(path, prepared.blob, { contentType: prepared.contentType }); if (uploaded.error) throw uploaded.error;
        const attachment = await supabase.from("document_attachment").insert({ document_id: id, person_id: pid, storage_path: path, file_name: file.name || `documento.${prepared.ext}`, content_type: prepared.contentType, size_bytes: prepared.blob.size, is_primary: true }); if (attachment.error) throw attachment.error;
        await supabase.from("traveler_document").update({ arquivo_path: path }).eq("id", id);
      }
      await qc.invalidateQueries({ queryKey: ["eu", pid] }); toast.success(`${nomeDocumento(tipo)} salvo`); nav({ to: "/pessoas/$pid/documentos/$did", params: { pid, did: id } });
    } catch { toast.error("Não foi possível salvar agora. Tente novamente com segurança."); setSaving(false); }
  }

  return <div className="min-h-screen bg-background pb-20"><Topo titulo="Adicionar documento" voltarPara="/pessoas/$pid" voltarParams={{ pid }} /><main className="mx-auto max-w-xl space-y-5 px-4 pt-5">
    {!file && <><TirarFoto onFoto={(f) => void receive(f)} className="gradient-hero w-full border-0 py-5 text-xl font-bold" /><p className="text-center text-base text-muted-foreground">A gente descobre o tipo e lê os dados. Você só confere.</p><div className="grid grid-cols-2 gap-3"><ZonaArquivo aceita="image/*,.heic,.heif" onArquivo={(f) => void receive(f)} className="tap flex flex-col items-center justify-center rounded-lg border-2 border-border text-lg font-bold"><FileImage size={28} /> Foto da galeria</ZonaArquivo><ZonaArquivo aceita={ACEITA_DOC} colar onArquivo={(f) => void receive(f)} className="tap flex flex-col items-center justify-center rounded-lg border-2 border-border text-lg font-bold"><FileUp size={28} /> Arquivo ou PDF</ZonaArquivo></div><DicaArrastar /></>}
    {!tipo && <section><h2 className="mb-3 text-2xl">Ou escolha o tipo</h2><div className="grid grid-cols-3 gap-2">{TIPOS.map(([id, label]) => <button key={id} onClick={() => setTipo(id)} className="tap rounded-lg border-2 border-border p-2 text-base font-bold">{label}</button>)}</div></section>}
    {file && <form action={(fd) => void save(fd)} className="space-y-4"><div className="rounded-lg border border-border bg-card p-3"><Miniatura src={previaDe(file)} className="h-40 w-full rounded-lg" /><p className="mt-3 flex items-center gap-2 text-lg font-bold">{reading ? <><Camera size={24} /> Lendo a foto…</> : readState === "ok" ? <><CheckCircle2 size={24} className="text-ok" /> Lemos a foto · confira e salve</> : "Não conseguimos ler. Preencha manualmente."}</p><button type="button" onClick={() => { setFile(null); setReadState("idle"); }} className="tap text-lg font-bold text-accent">Tirar outra foto</button></div>
      <Campo rotulo="Tipo"><select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>{TIPOS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Campo>
      {[['nome_no_documento','Nome no documento','text'],['numero','Número','text'],['pais_emissor','País emissor','text'],['sexo','Sexo','text'],['detalhe','Detalhe','text'],['emissao','Emissão','date'],['validade','Validade','date']].map(([key,label,input]) => <Campo key={key} rotulo={label}><input name={key} type={input} value={fields[key] ?? ""} onChange={(e) => setFields((old) => ({ ...old, [key]: e.target.value }))} className={inputCls} /></Campo>)}
      <button disabled={saving || reading || !owner} className="gradient-hero tap w-full rounded-lg text-xl font-bold">Salvar {nomeDocumento(tipo)}</button>
    </form>}
  </main></div>;
}