import { Copy, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { abrirWhatsApp } from "@/lib/links";

/** Painel de baixo: WhatsApp (sem número) ou copiar um texto pronto. */
export function CompartilharTexto({
  aberto,
  onOpenChange,
  titulo,
  texto,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  titulo: string;
  texto: string;
}) {
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Mensagem copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }
  return (
    <Drawer open={aberto} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-background">
        <DrawerHeader className="flex-row items-center justify-between gap-3 px-4 pt-4">
          <DrawerTitle className="text-2xl">{titulo}</DrawerTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
            className="tap flex items-center justify-center rounded-lg border-2 border-border text-foreground"
          >
            <X size={28} strokeWidth={2.2} />
          </button>
        </DrawerHeader>
        <div className="space-y-4 px-4 pb-8">
          <p className="rounded-lg border-2 border-border bg-card p-4 text-lg">{texto}</p>
          <button
            type="button"
            onClick={() => abrirWhatsApp(null, texto)}
            className="tap flex w-full items-center justify-center gap-3 rounded-lg bg-primary text-lg font-bold text-primary-foreground"
          >
            <MessageCircle size={26} strokeWidth={2.2} /> WhatsApp
          </button>
          <button
            type="button"
            onClick={copiar}
            className="tap flex w-full items-center justify-center gap-3 rounded-lg border-2 border-primary bg-transparent text-lg font-bold text-foreground"
          >
            <Copy size={26} strokeWidth={2.2} /> Copiar mensagem
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
