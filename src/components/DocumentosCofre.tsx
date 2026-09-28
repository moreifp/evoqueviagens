import { useEffect, useState } from "react";
import { ChevronRight, FileLock2, LockKeyhole, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DestravarCofre } from "@/components/Cofre";
import { deleteVaultDocument, listVaultDocuments, lockVault, readVaultDocument, useVaultUnlocked, type VaultDocument, type VaultDocumentContents } from "@/lib/vault";

const ROTULOS: Record<string, string> = { nome_no_documento: "Nome", numero: "Número", pais_emissor: "País", sexo: "Sexo", detalhe: "Detalhe 1", detalhe2: "Detalhe 2", emissao: "Emissão", validade: "Validade" };
const tituloDe = (c: VaultDocumentContents) => c.fields.nome_no_documento || c.fields.detalhe || c.file?.name || "Outro documento";

/** Abre o arquivo em nova aba (a aba nasce no toque, para o iPhone não bloquear). */
async function abrirOriginal(file: NonNullable<VaultDocumentContents["file"]>) {
  const janela = window.open("", "_blank");
  const bytes = Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0));
  let blob: Blob;
  if (/\.eml$/i.test(file.name) || file.type === "message/rfc822") {
    const { textoDoEml } = await import("@/lib/emailAgencia");
    const texto = textoDoEml(new TextDecoder().decode(bytes)) || "(e-mail vazio)";
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>E-mail</title></head><body style="font-family:-apple-system,sans-serif;font-size:17px;line-height:1.5;max-width:720px;margin:24px auto;padding:0 16px;color:#1c2733;white-space:pre-wrap">${texto.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</body></html>`;
    blob = new Blob([html], { type: "text/html" });
  } else {
    blob = new Blob([bytes], { type: file.type || "application/octet-stream" });
  }
  const url = URL.createObjectURL(blob);
  if (janela) janela.location.href = url; else window.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
}

export function DocumentosCofre({ uid, personId }: { uid: string; personId: string }) {
  const unlocked = useVaultUnlocked(uid);
  const [rows, setRows] = useState<VaultDocument[]>([]);
  const [titulos, setTitulos] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<{ row: VaultDocument; contents: VaultDocumentContents } | null>(null);
  const [busy, setBusy] = useState(false);
  const [aberto, setAberto] = useState(false);
  const liberado = aberto && unlocked;

  useEffect(() => {
    if (!liberado) { setSelected(null); setRows([]); setTitulos({}); return; }
    let alive = true;
    void listVaultDocuments(uid, personId).then(async (items) => {
      if (!alive) return; setRows(items);
      for (const row of items) {
        try { const c = await readVaultDocument(uid, row); if (!alive) return; setTitulos((t) => ({ ...t, [row.id]: tituloDe(c) })); } catch { /* segue */ }
      }
    }).catch(() => toast.error("Não foi possível abrir os arquivos do cofre."));
    return () => { alive = false; };
  }, [uid, personId, liberado]);

  function abrirSecao() { lockVault(); setAberto(true); }
  function fecharSecao() { lockVault(); setAberto(false); }
  async function open(row: VaultDocument) { try { setSelected({ row, contents: await readVaultDocument(uid, row) }); } catch { toast.error("Não foi possível abrir o arquivo."); } }
  async function remove() {
    if (!selected || busy || !window.confirm("Apagar este arquivo do cofre?")) return;
    setBusy(true);
    try { await deleteVaultDocument(uid, selected.row); setRows((old) => old.filter((r) => r.id !== selected.row.id)); setSelected(null); toast.success("Arquivo apagado do cofre"); }
    catch { toast.error("Não foi possível apagar o arquivo."); } finally { setBusy(false); }
  }

  if (!aberto) {
    return <button type="button" onClick={abrirSecao} className="tap flex min-h-14 w-full items-center gap-3 py-3 text-left"><span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-doc-soft text-doc"><LockKeyhole size={24} strokeWidth={2.2} /></span><span className="flex-1"><strong className="block text-lg">Cofre · arquivos</strong><span className="text-base text-muted-foreground">Arquivos cifrados que só você abre</span></span><ChevronRight size={26} /></button>;
  }
  return <section className="space-y-3">
    <div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-2xl"><LockKeyhole size={26} /> Cofre · arquivos</h2><Button type="button" variant="outline" onClick={fecharSecao}>Trancar</Button></div>
    {!unlocked ? <DestravarCofre uid={uid} /> : <>
      {!rows.length && <p className="text-base text-muted-foreground">Nenhum arquivo guardado no cofre nesta ficha.</p>}
      {rows.map((row) => <Button key={row.id} type="button" variant="outline" onClick={() => void open(row)} className="w-full justify-start text-left"><FileLock2 size={24} /> {titulos[row.id] ?? "Abrindo…"}</Button>)}
      {selected && <div className="space-y-3 rounded-lg border border-border bg-card p-4"><h3 className="text-xl font-bold">{tituloDe(selected.contents)}</h3>
        {Object.entries(selected.contents.fields).filter(([, value]) => value).map(([key, value]) => <p key={key} className="break-words text-lg"><span className="text-muted-foreground">{ROTULOS[key] ?? key}: </span>{value}</p>)}
        <div className="flex flex-wrap gap-2">{selected.contents.file && <Button type="button" onClick={() => void abrirOriginal(selected.contents.file!)}><ExternalLink size={22} /> Abrir arquivo original</Button>}<Button type="button" variant="outline" onClick={() => setSelected(null)}>Fechar</Button><Button type="button" variant="destructive" disabled={busy} onClick={() => void remove()}><Trash2 size={22} /> Apagar</Button></div>
      </div>}
    </>}
  </section>;
}
