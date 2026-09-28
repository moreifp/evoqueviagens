import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AlertTriangle, FileImage, FileUp, CheckCircle2, Keyboard, Loader2, RotateCw, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Topo } from "@/components/Chrome";
import { Campo, inputCls } from "@/components/Form";
import { ACEITA_QUALQUER, DicaArrastar, Miniatura, TirarFoto, ZonaArquivo, previaDe } from "@/components/ArquivoFoto";
import { euQuery, nomeDocumento } from "@/lib/eu";
import { blobParaDataUrl, melhorarDocumentoParaOcr, prepararArquivo } from "@/lib/imagem";
import { ErroLeitura, pdfPagina } from "@/lib/pdf";
import { textoDoEml } from "@/lib/emailAgencia";
import { NOME_DOC } from "@/lib/cadastro-tipos";
import { conferirDatasCNH, escolherRegistro, validaRegistroCNH } from "@/lib/cnh";
import { identificarDocumentoAdmin, lerDocumentoAdmin, lerPassaporteAdmin } from "@/lib/cadastro.functions";
import { supabase } from "@/integrations/supabase/client";
import { nomePais3 } from "@/lib/paises3";
import { salvarDadosPessoaPassaporte } from "@/lib/passaportePessoa";
import { DestravarCofre } from "@/components/Cofre";
import { saveVaultDocument, useVaultUnlocked } from "@/lib/vault";
import { Button } from "@/components/ui/button";

const TIPOS = [["passaporte", "Passaporte"], ["rg", "RG"], ["cnh", "CNH e PID"], ["visto", "Visto ou ESTA"], ["vacina", "Vacina"], ["seguro", "Seguro"], ["global_entry", "Global Entry"], ["outro", "Outro"]] as const;
/** Lista completa do seletor (inclui ETA, eTA, ETIAS…), para o tipo escolhido nunca virar "Passaporte". */
const TODOS_TIPOS: [string, string][] = [...Object.entries(NOME_DOC), ["outro", "Outro"]];

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
  const [manual, setManual] = useState(false); const [tipo, setTipo] = useState(search.tipo || ""); const [file, setFile] = useState<File | null>(null); const [fields, setFields] = useState<Record<string, string>>({}); const [reading, setReading] = useState(false); const [readState, setReadState] = useState<"idle" | "ok" | "fail" | "anexo">("idle"); const [saving, setSaving] = useState(false); const [regFalhou, setRegFalhou] = useState(false); const [motivo, setMotivo] = useState(""); const [conferir, setConferir] = useState(false); const [previa, setPrevia] = useState<string | null>(null); const [guardarNoCofre, setGuardarNoCofre] = useState(false); const unlocked = useVaultUnlocked(data?.uid); const editDoc = data?.documentos.find((doc) => doc.id === search.did);
  useEffect(() => { if (!editDoc) return; setTipo(editDoc.tipo); setFields((old) => ({ ...old, nome_no_documento: editDoc.nome_no_documento ?? "", numero: editDoc.numero ?? "", pais_emissor: editDoc.pais_emissor ?? "", sexo: editDoc.sexo ?? "", detalhe: editDoc.detalhe ?? "", emissao: editDoc.emissao ?? "", validade: editDoc.validade ?? "", primeira_habilitacao: editDoc.primeira_habilitacao ?? "", local_expedicao: editDoc.local_expedicao ?? "" })); }, [editDoc?.id]);
  useEffect(() => { if (!data) return; setFields((old) => ({ ...old, nascimento: old.nascimento || data.pessoa.data_nascimento || "", nacionalidade: old.nacionalidade || data.pessoa.nacionalidades[0] || "" })); }, [data?.pessoa.id]);
  if (!data) return <p className="p-6 text-lg">Carregando…</p>;
  const owner = data.pessoa.account_id === data.uid;
  const ehCnh = tipo === "cnh";
  const numeroCnhInvalido = ehCnh && !!fields.numero && !validaRegistroCNH(fields.numero);
  const suspeitos = new Set<string>(ehCnh ? conferirDatasCNH(fields) : []);
  if (numeroCnhInvalido || (ehCnh && regFalhou && !fields.numero)) suspeitos.add("numero");
  const precisaConfirmar = readState === "ok" && suspeitos.size > 0;

  function aplicarPassaporte(r: { mrz: { numero?: string; paisEmissor?: string; nacionalidade?: string; nomeCompleto?: string; sexo?: string | null; validade?: string | null; nascimento?: string | null }; emissao?: string | null }) {
    const lido: Record<string, string> = { numero: r.mrz.numero ?? "", pais_emissor: r.mrz.paisEmissor || r.mrz.nacionalidade || "", nome_no_documento: r.mrz.nomeCompleto ?? "", sexo: r.mrz.sexo ?? "", validade: r.mrz.validade ?? "", emissao: r.emissao ?? "", nascimento: r.mrz.nascimento ?? "", nacionalidade: r.mrz.nacionalidade ?? "" };
    setFields((old) => { const n = { ...old }; for (const [k, v] of Object.entries(lido)) if (v && !n[k]) n[k] = v; return n; });
  }

  async function aplicarOutro(r: Awaited<ReturnType<typeof readDoc>>, detected: string) {
    if (!r.ok) throw new ErroLeitura("chamada da IA", "Não achamos os dados nesse documento");
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

  async function lerImagem(origem: Blob, forced: string | undefined, pdf: boolean) {
    let image: string;
    try { image = await blobParaDataUrl(await melhorarDocumentoParaOcr(origem, pdf ? 3000 : 2200)); }
    catch (e) { throw new ErroLeitura("melhorar imagem", "Não deu para preparar a imagem", e); }
    let detected = forced || tipo;
    if (!detected) { const r = await identify({ data: { imagem: image } }); detected = r.ok ? r.tipo : "outro"; setTipo(detected); }
    if (detected === "passaporte") {
      const r = await readPassport({ data: { imagem: image } });
      if (!r.ok) throw new ErroLeitura("MRZ", ("motivo" in r && r.motivo) || "Não achamos as linhas de baixo do passaporte");
      aplicarPassaporte(r); if (r.conferir) setConferir(true);
    } else await aplicarOutro(await readDoc({ data: { imagem: image, tipo: detected } }), detected);
  }

  async function receive(next: File, forced?: string) {
    setFile(next); setReading(true); setReadState("idle"); setRegFalhou(false); setMotivo(""); setConferir(false); setPrevia(null);
    const alvo = forced || tipo;
    try {
      // E-mail (.eml): lê o texto; o arquivo fica como anexo.
      if (/\.eml$/i.test(next.name) || next.type === "message/rfc822") {
        const tipoDoc = alvo && alvo !== "passaporte" ? alvo : "outro";
        setTipo(tipoDoc);
        const texto = textoDoEml(await next.text()).slice(0, 55_000);
        if (!texto) throw new ErroLeitura("ler e-mail", "O e-mail está vazio");
        await aplicarOutro(await readDoc({ data: { imagem: "", tipo: tipoDoc, texto } }), tipoDoc);
        setConferir(true); setReadState("ok"); return;
      }
      const prepared = await prepararArquivo(next, 2200);
      // Arquivos que não são foto nem PDF (doc, xls…) só anexam, sem leitura.
      if (prepared.ext !== "jpg" && prepared.ext !== "heic" && prepared.ext !== "pdf") { setTipo(alvo || "outro"); setReadState("anexo"); return; }
      if (prepared.ext !== "pdf") { await lerImagem(prepared.blob, forced, false); setReadState("ok"); return; }
      // PDF: uma página por vez (1ª; se falhar, 2ª), sem empilhar. O PDF original é o anexo.
      let ultimo: unknown = null;
      for (let n = 1; n <= 2; n++) {
        const pg = await pdfPagina(next, n);
        setPrevia(URL.createObjectURL(pg.imagem));
        try { await lerImagem(pg.imagem, forced, true); setReadState("ok"); return; }
        catch (e) { ultimo = e; console.warn(`LEITURA_PDF pagina ${n}`, e); if (n >= pg.total) break; }
      }
      throw ultimo;
    } catch (e) {
      const er = e instanceof ErroLeitura ? e : new ErroLeitura("chamada da IA", "A leitura automática falhou", e);
      console.error(`LEITURA_DOCUMENTO falhou no passo: ${er.passo}`, er.causa ?? er);
      setMotivo(er.motivo); setReadState("fail");
    } finally { setReading(false); }
  }

  async function save(form: FormData) {
    if (!owner || !tipo) return; setSaving(true);
    let passo = "Não deu para salvar os dados do documento.";
    try {
      if (tipo === "outro" && guardarNoCofre && !editDoc) {
        if (!unlocked) throw new Error("Destrave o cofre antes de guardar.");
        const valores = Object.fromEntries(["nome_no_documento", "numero", "pais_emissor", "sexo", "detalhe", "emissao", "validade"].map((key) => [key, String(form.get(key) || "")]).filter(([, value]) => value));
        let original: { name: string; type: string; data: string } | undefined;
        if (file) {
          passo = "Não deu para cifrar o arquivo original.";
          const bytes = new Uint8Array(await file.arrayBuffer());
          let binary = ""; for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
          original = { name: file.name, type: file.type || "application/octet-stream", data: btoa(binary) };
        }
        passo = "Não deu para guardar o arquivo no cofre.";
        const result = await saveVaultDocument(data.uid, pid, { fields: valores, file: original });
        toast.success(result.localOnly ? "Guardado no aparelho · sincroniza quando voltar a internet" : "Guardado no cofre");
        nav({ to: "/pessoas/$pid", params: { pid } });
        return;
      }
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
    } catch (error) { toast.error(error instanceof Error && error.message === "Destrave o cofre antes de guardar." ? error.message : passo); setSaving(false); }
  }

  const campos: [string, string, string][] = [['nome_no_documento','Nome no documento','text'],['numero','Número','text'],['pais_emissor','País emissor','text'],['sexo','Sexo','text'],['detalhe','Detalhe','text'],['emissao','Emissão','date'],['validade','Validade','date']];
  if (ehCnh) campos.splice(5, 0, ['local_expedicao','Local de expedição','text'], ['primeira_habilitacao','1ª habilitação','date']);
  const ambar = (k: string) => (suspeitos.has(k) && (readState === "ok" || k === "numero") ? " border-warn ring-2 ring-warn" : "");

  return <div className="min-h-screen bg-background pb-20"><Topo titulo={editDoc ? `Editar ${nomeDocumento(editDoc.tipo)}` : "Adicionar documento"} voltarPara="/pessoas/$pid" voltarParams={{ pid }} /><main className="mx-auto max-w-xl space-y-5 px-4 pt-5">
    {!file && !manual && <><TirarFoto onFoto={(f) => void receive(f)} rotulo={editDoc ? "Tirar nova foto" : "Fotografar documento"} sub={editDoc ? "A foto atual permanece se você não escolher outra." : "Foto ou PDF. A gente lê os dados, você só confere."} className="gradient-hero shadow-medium min-h-24 w-full py-6 text-xl font-bold" /><div className="grid grid-cols-2 gap-3"><ZonaArquivo aceita="image/*,.heic,.heif" onArquivo={(f) => void receive(f)} className="tap flex flex-col items-center justify-center rounded-lg border-2 border-border text-lg font-bold"><FileImage size={28} /> Foto da galeria</ZonaArquivo><ZonaArquivo aceita={ACEITA_QUALQUER} colar onArquivo={(f) => void receive(f)} className="tap flex flex-col items-center justify-center rounded-lg border-2 border-border text-lg font-bold"><FileUp size={28} /> Arquivo ou PDF</ZonaArquivo></div><DicaArrastar />{!editDoc && <button type="button" onClick={() => { setManual(true); if (!tipo) setTipo("outro"); }} className="tap flex w-full items-center justify-center gap-2 rounded-lg border-2 border-border text-lg font-bold"><Keyboard size={26} /> Não tenho foto · digitar os dados</button>}</>}
    {!tipo && <section><h2 className="mb-3 text-2xl">Ou escolha o tipo</h2><div className="grid grid-cols-3 gap-2">{TIPOS.map(([id, label]) => <button key={id} onClick={() => setTipo(id)} className="tap rounded-lg border-2 border-border p-2 text-base font-bold">{label}</button>)}</div></section>}
    {(file || editDoc || manual) && <form action={(fd) => void save(fd)} className="space-y-4">{file && <div className="rounded-lg border border-border bg-card p-3">{previa ? <img src={previa} alt="Página do PDF que está sendo lida" className="h-40 w-full rounded-lg bg-muted object-contain" /> : <Miniatura src={previaDe(file)} className="h-40 w-full rounded-lg" />}<p className="mt-3 flex items-center gap-2 text-lg font-bold">{reading ? <><Loader2 size={24} className="animate-spin" /> Lendo…</> : readState === "ok" ? precisaConfirmar || conferir ? <><AlertTriangle size={24} className="text-warn" /> Lemos o documento · confira os campos</> : <><CheckCircle2 size={24} className="text-ok" /> Lemos a foto · confira</> : readState === "fail" ? "Não deu para ler" : readState === "anexo" ? "Arquivo anexado · digite os dados" : null}</p>{readState === "fail" && motivo && <p className="text-base text-muted-foreground">{motivo}</p>}<div className="flex flex-wrap gap-4">{readState === "fail" && !reading && <button type="button" onClick={() => void receive(file, tipo || undefined)} className="tap inline-flex items-center gap-2 text-lg font-bold text-accent"><RotateCw size={22} /> Tentar ler de novo</button>}<button type="button" onClick={() => { setFile(null); setReadState("idle"); setPrevia(null); }} className="tap text-lg font-bold text-accent">Trocar arquivo</button></div></div>}{manual && !file && <button type="button" onClick={() => setManual(false)} className="tap text-lg font-bold text-accent">Usar foto em vez de digitar</button>}
      <Campo rotulo="Tipo"><select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>{TODOS_TIPOS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Campo>
      {tipo === "outro" && !editDoc && <div className="space-y-3 rounded-lg border border-border bg-card p-4"><label className="flex min-h-14 items-center gap-3 text-lg font-bold"><input type="checkbox" checked={guardarNoCofre} onChange={(e) => setGuardarNoCofre(e.target.checked)} className="h-7 w-7 accent-primary" /><LockKeyhole size={26} /> Guardar no cofre</label>{guardarNoCofre && <><p className="text-base text-muted-foreground">Só você pode abrir. O arquivo original e os dados ficam cifrados; não entram nos documentos compartilhados.</p>{!unlocked && <DestravarCofre uid={data.uid} />}</>}</div>}
      {campos.map(([key,label,input]) => <Campo key={key} rotulo={(ROTULOS[tipo] ?? {})[key] ?? label}><input name={key} type={input} max={input === "date" ? "2099-12-31" : undefined} inputMode={ehCnh && key === "numero" ? "numeric" : undefined} maxLength={ehCnh && key === "numero" ? 11 : undefined} placeholder={ehCnh && key === "numero" && regFalhou && !fields.numero ? "Não deu para ler o nº de registro · digite" : undefined} value={fields[key] ?? ""} onChange={(e) => setFields((old) => ({ ...old, [key]: ehCnh && key === "numero" ? e.target.value.replace(/\D/g, "") : e.target.value }))} className={inputCls + ambar(key)} />{ehCnh && key === "numero" && fields.numero && <p className={`mt-1 text-base font-bold ${numeroCnhInvalido ? "text-warn" : "text-ok"}`}>{numeroCnhInvalido ? (fields.numero.length < 11 ? `${fields.numero.length} de 11 dígitos` : "Número não confere · verifique") : "Número confere"}</p>}</Campo>)}
      {tipo === "passaporte" && <><Campo rotulo="Data de nascimento"><input name="nascimento" type="date" max="2099-12-31" value={fields.nascimento ?? ""} onChange={(e) => setFields((o) => ({ ...o, nascimento: e.target.value }))} className={inputCls} /></Campo><Campo rotulo={`Nacionalidade${fields.nacionalidade ? ` · ${nomePais3(fields.nacionalidade)}` : ""}`}><input name="nacionalidade" type="text" maxLength={3} placeholder="BRA" autoCapitalize="characters" value={fields.nacionalidade ?? ""} onChange={(e) => setFields((o) => ({ ...o, nacionalidade: e.target.value.toUpperCase() }))} className={inputCls} /></Campo></>}
      {precisaConfirmar && <p className="rounded-lg border-2 border-warn p-3 text-lg">Algumas datas ou o número não conferem. Confira os campos em destaque antes de confirmar.</p>}
      <Button disabled={saving || reading || !owner || (tipo === "outro" && guardarNoCofre && !unlocked)} className="gradient-hero w-full text-xl font-bold">{tipo === "outro" && guardarNoCofre ? "Guardar no cofre" : readState === "ok" ? "Confirmar" : `Salvar ${nomeDocumento(tipo)}`}</Button>
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
