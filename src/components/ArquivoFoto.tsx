import { useEffect, useRef, useState } from "react";
import { Camera, FileText, X } from "lucide-react";
import { toast } from "sonner";

/** Sem `capture`: no iPhone aparece o menu Tirar foto · Fototeca · Escolher arquivo. */
export const ACEITA_FOTO = "image/*,.heic,.heif";
export const ACEITA_DOC = "image/*,.heic,.heif,application/pdf";

export function aceitavel(f: File, aceita: string) {
  const img = f.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name);
  const pdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
  return img || (pdf && aceita.includes("pdf"));
}

// Colar (Ctrl/Cmd+V): vai para a área de foto mais recente na tela.
const pilha: ((f: File) => void)[] = [];
let ouvindo = false;
function aoColar(e: ClipboardEvent) {
  const f = e.clipboardData?.files?.[0];
  const h = pilha[pilha.length - 1];
  if (f && h) {
    e.preventDefault();
    h(f);
  }
}

export function ZonaArquivo({
  onArquivo,
  aceita = ACEITA_DOC,
  colar = false,
  className = "",
  ariaLabel,
  children,
}: {
  onArquivo: (f: File) => void;
  aceita?: string;
  colar?: boolean;
  className?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = useState(false);
  const cb = useRef(onArquivo);
  cb.current = onArquivo;

  function receber(f: File | undefined) {
    if (!f) return;
    if (!aceitavel(f, aceita)) return void toast.error(aceita.includes("pdf") ? "Use uma foto ou um PDF." : "Use uma foto.");
    cb.current(f);
  }

  useEffect(() => {
    if (!colar) return;
    const h = (f: File) => receber(f);
    pilha.push(h);
    if (!ouvindo && typeof window !== "undefined") {
      window.addEventListener("paste", aoColar);
      ouvindo = true;
    }
    return () => {
      const i = pilha.indexOf(h);
      if (i >= 0) pilha.splice(i, 1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colar]);

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={aceita}
        className="hidden"
        onChange={(e) => {
          receber(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => ref.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setSobre(true);
        }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSobre(false);
          receber(e.dataTransfer.files?.[0]);
        }}
        className={`${className} ${sobre ? "ring-4 ring-accent" : ""}`}
      >
        {children}
      </button>
    </>
  );
}

/** Dica só para computador (mouse). */
export function DicaArrastar({ en = false }: { en?: boolean }) {
  return (
    <span className="hidden text-base font-normal [@media(pointer:fine)]:block">
      {en ? "Drag the photo here or tap to choose" : "Arraste a foto aqui ou toque para escolher"}
    </span>
  );
}

export function previaDe(f: File): string {
  return f.type === "application/pdf" || /\.pdf$/i.test(f.name) ? "pdf" : URL.createObjectURL(f);
}

export function Miniatura({ src, className = "" }: { src: string | null | undefined; className?: string }) {
  if (!src) return null;
  if (src === "pdf" || /\.pdf(\?|$)/i.test(src))
    return (
      <span className={`flex items-center justify-center bg-muted text-foreground ${className}`}>
        <FileText size={28} strokeWidth={2.2} aria-label="PDF" />
      </span>
    );
  return <img src={src} alt="" className={`object-cover ${className}`} />;
}
