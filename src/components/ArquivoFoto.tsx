import { useEffect, useRef, useState } from "react";
import { Camera, FileText, X } from "lucide-react";
import { toast } from "sonner";

/** Sem `capture`: no iPhone aparece o menu Tirar foto · Fototeca · Escolher arquivo. */
export const ACEITA_FOTO = "image/*,.heic,.heif";
export const ACEITA_DOC = "image/*,.heic,.heif,application/pdf,.eml,message/rfc822";
/** Qualquer arquivo (anexo simples, sem leitura). Vazio = sem restrição; no iPhone, o accept universal esconde arquivos como .eml. */
export const ACEITA_QUALQUER = "";

export function aceitavel(f: File, aceita: string) {
  if (!aceita || aceita.includes("*")) return true;
  const img = f.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name);
  const pdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
  const eml = f.type === "message/rfc822" || /\.eml$/i.test(f.name);
  return img || (pdf && aceita.includes("pdf")) || (eml && aceita.includes("eml"));
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
    if (!aceitavel(f, aceita))
      return void toast.error(aceita.includes("pdf") ? "Use uma foto ou um PDF." : "Use uma foto.");
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
        {...(aceita ? { accept: aceita } : {})}
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

/** Botão "Tirar foto" com câmera ao vivo (computador e telefone). Painel inline, não modal. */
export function TirarFoto({
  onFoto,
  en = false,
  className = "",
  rotulo,
  sub,
}: {
  onFoto: (f: File) => void;
  en?: boolean;
  className?: string;
  rotulo?: string;
  sub?: string;
}) {
  const [aberta, setAberta] = useState(false);
  const [erro, setErro] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  function parar() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  // Liga a câmera ao vídeo só depois que ele existe na tela (antes ficava preto).
  useEffect(() => {
    const v = videoRef.current;
    const s = streamRef.current;
    if (!aberta || !v || !s) return;
    v.srcObject = s;
    v.muted = true;
    v.setAttribute("playsinline", "");
    const tocar = () => void v.play().catch(() => {});
    v.addEventListener("loadedmetadata", tocar);
    tocar();
    return () => v.removeEventListener("loadedmetadata", tocar);
  }, [aberta]);

  async function abrir() {
    setErro(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setAberta(true);
    } catch {
      setErro(true);
      toast.error(
        en
          ? "I couldn't access the camera. You can choose a photo instead."
          : "Não consegui acessar a câmera. Você pode escolher uma foto da galeria.",
      );
    }
  }

  function fechar() {
    parar();
    setAberta(false);
  }

  function capturar() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) {
      toast.error(
        en
          ? "Wait for the camera to load and try again."
          : "Aguarde a câmera carregar e tente de novo.",
      );
      return;
    }
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob(
      (b) => {
        if (b) onFoto(new File([b], "foto.jpg", { type: "image/jpeg" }));
        fechar();
      },
      "image/jpeg",
      0.92,
    );
  }

  useEffect(() => () => parar(), []);

  if (aberta)
    return (
      <div
        className={`flex flex-col gap-3 rounded-xl border-2 border-border bg-card p-3 ${className}`}
      >
        <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg bg-black" />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={capturar}
            className="tap flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-lg font-semibold text-primary-foreground"
          >
            <Camera size={24} strokeWidth={2.2} aria-hidden /> {en ? "Capture" : "Capturar"}
          </button>
          <button
            type="button"
            onClick={fechar}
            className="tap flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-border px-5 text-lg text-foreground"
          >
            <X size={24} strokeWidth={2.2} aria-hidden /> {en ? "Cancel" : "Cancelar"}
          </button>
        </div>
      </div>
    );

  return (
    <button
      type="button"
      onClick={abrir}
      disabled={erro}
      className={`tap flex min-h-14 items-center justify-center gap-2 rounded-xl px-5 text-lg ${className.includes("gradient-hero") ? "" : "border-2 border-border text-foreground"} ${className}`}
    >
      <Camera size={sub ? 32 : 24} strokeWidth={2.2} aria-hidden className="shrink-0" />
      {sub ? (
        <span className="text-left">
          <span className="block">{rotulo}</span>
          <span className="block text-base font-medium">{sub}</span>
        </span>
      ) : (
        (rotulo ?? (en ? "Take photo" : "Tirar foto"))
      )}
    </button>
  );
}

export function previaDe(f: File): string {
  if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) return "pdf";
  if (!f.type.startsWith("image/") && !/\.(heic|heif|jpe?g|png|webp)$/i.test(f.name))
    return "arquivo";
  return URL.createObjectURL(f);
}

export function Miniatura({
  src,
  className = "",
}: {
  src: string | null | undefined;
  className?: string;
}) {
  if (!src) return null;
  if (src === "pdf" || /\.pdf(\?|$)/i.test(src))
    return (
      <span className={`flex items-center justify-center bg-muted text-foreground ${className}`}>
        <FileText size={28} strokeWidth={2.2} aria-label="PDF" />
      </span>
    );
  if (src === "arquivo")
    return (
      <span className={`flex items-center justify-center bg-muted text-foreground ${className}`}>
        <FileText size={28} strokeWidth={2.2} aria-label="Arquivo" />
      </span>
    );
  return <img src={src} alt="" className={`object-cover ${className}`} />;
}
