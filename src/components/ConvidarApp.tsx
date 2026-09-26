import { useState } from "react";
import { Copy, Mail, MessageCircle, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { abrirWhatsApp, mensagemConviteApp } from "@/lib/links";

/** Botão "Convidar" do painel Eu: divulga o app por WhatsApp, e-mail ou cópia. */
export function ConvidarApp() {
  const [aberto, setAberto] = useState(false);
  const { assunto, texto } = mensagemConviteApp("pt");

  function enviarEmail() {
    window.location.href = `mailto:?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`;
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Mensagem copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="tap flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-primary bg-transparent px-4 text-lg font-bold text-foreground sm:flex-none"
      >
        <UserPlus size={26} strokeWidth={2.2} /> Convidar
      </button>

      <Drawer open={aberto} onOpenChange={setAberto}>
        <DrawerContent className="bg-background">
          <DrawerHeader className="flex-row items-center justify-between gap-3 px-4 pt-4">
            <DrawerTitle className="text-2xl">Convidar para o Evoque</DrawerTitle>
            <button
              type="button"
              onClick={() => setAberto(false)}
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
              onClick={enviarEmail}
              className="tap flex w-full items-center justify-center gap-3 rounded-lg border-2 border-primary bg-transparent text-lg font-bold text-foreground"
            >
              <Mail size={26} strokeWidth={2.2} /> E-mail
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
    </>
  );
}
