import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, FileText, ImagePlus, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { anexosQuery, type Anexo } from "@/lib/data";
import { abrirAnexo, guardarAnexo } from "@/lib/anexosOffline";
import { mutar } from "@/lib/outbox";
import { aviso, naTela, novoId } from "@/lib/itens";

/** Vários anexos por item (voucher, e-ticket, PDF). Abre a cópia do aparelho quando não há internet. */
export function AnexosItem({
  tripId,
  itemTipo,
  itemId,
  podeEditar,
}: {
  tripId: string;
  itemTipo: Anexo["item_tipo"];
  itemId: string;
  podeEditar: boolean;
}) {
  const qc = useQueryClient();
  const { data } = useQuery(anexosQuery(tripId));
  const anexos = (data ?? []).filter((a) => a.item_id === itemId);
  const input = useRef<HTMLInputElement>(null);
  const inputCamera = useRef<HTMLInputElement>(null);
  const inputGaleria = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const key = anexosQuery(tripId).queryKey;

  async function enviarArquivo(arq: File) {
    if (!navigator.onLine) return toast.error("Para anexar arquivo é preciso internet.");
    setEnviando(true);
    try {
      const id = novoId();
      const limpo = arq.name.replace(/[^\w.\-]+/g, "_").slice(-80);
      const path = `trip/${tripId}/${itemId}/${id}-${limpo}`;
      const up = await supabase.storage.from("documentos").upload(path, arq, { contentType: arq.type || "application/octet-stream" });
      if (up.error) throw new Error(up.error.message);
      const row: Anexo = { id, item_tipo: itemTipo, item_id: itemId, storage_path: path, nome: arq.name, content_type: arq.type || "application/octet-stream", size_bytes: arq.size };
      try { await mutar({ tipo: "insert", tabela: "item_attachment", valores: row }); } catch (e) { await supabase.storage.from("documentos").remove([path]); throw e; }
      naTela<Anexo>(qc, key, (l) => [...l, row]);
      void guardarAnexo(path);
      toast.success("Anexo guardado");
    } catch (e) {
      toast.error((e as Error).message || "Não deu para anexar.");
    } finally {
      setEnviando(false);
    }
  }

  async function apagar(a: Anexo) {
    naTela<Anexo>(qc, key, (l) => l.filter((x) => x.id !== a.id));
    const r = await mutar({ tipo: "update", tabela: "item_attachment", id: a.id, valores: { deleted_at: new Date().toISOString() } });
    toast(aviso(r, "Anexo apagado"), {
      duration: 10_000,
      action: {
        label: "Desfazer",
        onClick: () => {
          naTela<Anexo>(qc, key, (l) => [...l, a]);
          void mutar({ tipo: "update", tabela: "item_attachment", id: a.id, valores: { deleted_at: null } });
        },
      },
    });
  }

  if (!anexos.length && !podeEditar) return null;
  return (
    <div className="border-t border-border">
      {anexos.length > 0 && <p className="px-4 pt-3 text-base font-bold text-muted-foreground">Arquivo original e anexos</p>}
      {anexos.map((a, i) => (
        <div key={a.id} className="flex items-stretch border-b border-border last:border-b-0">
          <button
            onClick={() => void abrirAnexo(a.storage_path).then((ok) => !ok && toast.error("Sem internet e sem cópia guardada deste arquivo."))}
            className="tap flex min-w-0 flex-1 items-center gap-3 px-4 text-left text-lg font-bold text-foreground"
          >
            <FileText size={26} strokeWidth={2.2} className="shrink-0 text-accent" />
            <span className="truncate">{a.nome}</span>
            {i === 0 && <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-sm font-bold text-foreground">Original</span>}
          </button>
          {podeEditar && (
            <button onClick={() => void apagar(a)} aria-label={`Apagar ${a.nome}`} className="tap flex w-16 items-center justify-center text-destructive">
              <Trash2 size={24} strokeWidth={2.2} />
            </button>
          )}
        </div>
      ))}
      {podeEditar && (
        <>
          <input
            ref={input}
            type="file"
            accept="image/*,application/pdf,.eml,message/rfc822"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void enviarArquivo(f);
            }}
          />
          <input
            ref={inputCamera}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void enviarArquivo(f);
            }}
          />
          <input
            ref={inputGaleria}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void enviarArquivo(f);
            }}
          />
          <div
            onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastando(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void enviarArquivo(f);
            }}
            className={arrastando ? "bg-accent/10" : undefined}
          >
            <div className="grid grid-cols-3">
              <button
                onClick={() => inputCamera.current?.click()}
                disabled={enviando}
                className="tap flex items-center justify-center gap-2 bg-muted text-base font-bold text-foreground"
              >
                <Camera size={24} strokeWidth={2.2} />
                Câmera
              </button>
              <button
                onClick={() => inputGaleria.current?.click()}
                disabled={enviando}
                className="tap flex items-center justify-center gap-2 border-x border-border bg-muted text-base font-bold text-foreground"
              >
                <ImagePlus size={24} strokeWidth={2.2} />
                Galeria
              </button>
              <button
                onClick={() => input.current?.click()}
                disabled={enviando}
                className="tap flex items-center justify-center gap-2 bg-muted text-base font-bold text-foreground"
              >
                <Paperclip size={24} strokeWidth={2.2} />
                Arquivo
              </button>
            </div>
            <p className="bg-muted px-4 pb-3 text-center text-sm text-muted-foreground">
              {enviando ? "Enviando…" : "Ou arraste um arquivo para cá"}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
