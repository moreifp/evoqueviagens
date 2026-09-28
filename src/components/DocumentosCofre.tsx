import { useEffect, useState } from "react";
import { Download, FileLock2, LockKeyhole, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DestravarCofre } from "@/components/Cofre";
import { deleteVaultDocument, listVaultDocuments, readVaultDocument, useVaultUnlocked, type VaultDocument, type VaultDocumentContents } from "@/lib/vault";

export function DocumentosCofre({ uid, personId }: { uid: string; personId: string }) {
  const unlocked = useVaultUnlocked(uid);
  const [rows, setRows] = useState<VaultDocument[]>([]);
  const [selected, setSelected] = useState<{ row: VaultDocument; contents: VaultDocumentContents } | null>(null);
  const [busy, setBusy] = useState(false);
  const [aberto, setAberto] = useState(false);
  useEffect(() => { if (!unlocked) { setSelected(null); setRows([]); return; } let alive = true; void listVaultDocuments(uid, personId).then((items) => { if (alive) setRows(items); }).catch(() => toast.error("Não foi possível abrir os arquivos do cofre.")); return () => { alive = false; }; }, [uid, personId, unlocked]);
  async function open(row: VaultDocument) { try { setSelected({ row, contents: await readVaultDocument(uid, row) }); } catch { toast.error("Não foi possível abrir o arquivo."); } }
  function download(contents: VaultDocumentContents) {
    if (!contents.file) return;
    const bytes = Uint8Array.from(atob(contents.file.data), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: contents.file.type || "application/octet-stream" }));
    const a = document.createElement("a"); a.href = url; a.download = contents.file.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  async function remove() {
    if (!selected || busy || !window.confirm("Apagar este arquivo do cofre?")) return;
    setBusy(true);
    try { await deleteVaultDocument(uid, selected.row); setRows((old) => old.filter((r) => r.id !== selected.row.id)); setSelected(null); toast.success("Arquivo apagado do cofre"); }
    catch { toast.error("Não foi possível apagar o arquivo."); } finally { setBusy(false); }
  }
  if (!aberto && !unlocked) {
    return <button type="button" onClick={() => setAberto(true)} className="tap flex min-h-14 w-full items-center gap-3 rounded-lg border border-border bg-card p-4 text-left"><LockKeyhole size={26} /><span className="flex-1"><strong className="block text-lg">Cofre · arquivos</strong><span className="text-base text-muted-foreground">Arquivos cifrados que só você abre</span></span></button>;
  }
  return <section className="space-y-3">
    <h2 className="flex items-center gap-2 text-2xl"><LockKeyhole size={26} /> Cofre · arquivos</h2>
    {!unlocked ? <DestravarCofre uid={uid} /> : <>
      {!rows.length && <p className="text-base text-muted-foreground">Nenhum arquivo guardado no cofre nesta ficha.</p>}
      {rows.map((row) => <Button key={row.id} type="button" variant="outline" onClick={() => void open(row)} className="w-full justify-start text-left"><FileLock2 size={24} /> Arquivo guardado · {new Date(row.created_at).toLocaleDateString("pt-BR")}</Button>)}
      {selected && <div className="space-y-3 rounded-lg border border-border bg-card p-4"><h3 className="text-xl font-bold">{selected.contents.fields.detalhe || selected.contents.file?.name || "Outro documento"}</h3>
        {Object.entries(selected.contents.fields).filter(([, value]) => value).map(([key, value]) => <p key={key} className="break-words text-lg"><span className="text-muted-foreground">{({ nome_no_documento: "Nome", numero: "Número", pais_emissor: "País", sexo: "Sexo", detalhe: "Detalhe", emissao: "Emissão", validade: "Validade" } as Record<string, string>)[key] ?? key}: </span>{value}</p>)}
        <div className="flex flex-wrap gap-2">{selected.contents.file && <Button type="button" onClick={() => download(selected.contents)}><Download size={22} /> Abrir arquivo original</Button>}<Button type="button" variant="outline" onClick={() => setSelected(null)}>Fechar</Button><Button type="button" variant="destructive" disabled={busy} onClick={() => void remove()}><Trash2 size={22} /> Apagar</Button></div>
      </div>}
    </>}
  </section>;
}