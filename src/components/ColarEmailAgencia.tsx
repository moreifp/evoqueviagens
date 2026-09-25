import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail, Upload } from "lucide-react";
import { toast } from "sonner";
import { lerEmailAgencia, type Trecho } from "@/lib/reserva-ai.functions";
import { textoDoEml, textoParaOriginal, type Original } from "@/lib/emailAgencia";
import { useConexao } from "@/lib/outbox";

const MIDIA = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
type Mime = (typeof MIDIA)[number];

function lerDataUrl(f: Blob) {
  return new Promise<string>((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => erro(new Error("Não consegui abrir o arquivo.")); r.readAsDataURL(f); });
}

/** "Colar e-mail da agência": texto colado, .eml, PDF ou print. A IA lê só voos, passageiros e bagagem — nunca preços. */
export function ColarEmailAgencia({ onLido, compacto }: { onLido: (trechos: Trecho[], original: Original) => void; compacto?: boolean }) {
  const ler = useServerFn(lerEmailAgencia);
  const { online } = useConexao();
  const [aberto, setAberto] = useState(!compacto);
  const [texto, setTexto] = useState("");
  const [lendo, setLendo] = useState(false);
  const [sobre, setSobre] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function processar(arq?: File) {
    if (lendo) return;
    setLendo(true);
    try {
      let t: string | null = texto.trim() || null, dado: string | null = null, mime: Mime | null = null, nome: string | null = null;
      let original: Original;
      if (arq) {
        nome = arq.name;
        if (/\.eml$/i.test(arq.name) || arq.type === "message/rfc822") {
          const raw = await arq.text();
          t = textoDoEml(raw);
          original = { nome: arq.name, mime: "message/rfc822", data: await lerDataUrl(arq) };
        } else if ((MIDIA as readonly string[]).includes(arq.type)) {
          dado = await lerDataUrl(arq); mime = arq.type as Mime; t = null;
          original = { nome: arq.name, mime: arq.type, data: dado };
        } else if (arq.type.startsWith("text/")) {
          t = await arq.text();
          original = { nome: arq.name, mime: arq.type, data: await lerDataUrl(arq) };
        } else throw new Error("Use o texto do e-mail, um arquivo .eml, um PDF ou um print.");
      } else {
        if (!t) throw new Error("Cole o texto do e-mail.");
        original = textoParaOriginal(t);
      }
      const r = await ler({ data: { texto: t, arquivo: dado, nome, mime } });
      if (!r.trechos.length) throw new Error("Não encontrei voos neste e-mail.");
      toast.success(`${r.trechos.length} trecho${r.trechos.length > 1 ? "s" : ""} lido${r.trechos.length > 1 ? "s" : ""}. Confira antes de salvar.`);
      onLido(r.trechos, original);
      setTexto("");
    } catch (e) {
      toast.error((e as Error).message || "Não consegui ler o e-mail.");
    } finally { setLendo(false); }
  }

  if (!aberto) return (
    <button type="button" onClick={() => setAberto(true)} className="tap flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-accent text-lg font-bold text-accent">
      <Mail size={26} strokeWidth={2.2} /> Colar e-mail da agência
    </button>
  );

  return (
    <section
      aria-label="Colar e-mail da agência"
      onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
      onDragLeave={() => setSobre(false)}
      onDrop={(e) => { e.preventDefault(); setSobre(false); const f = e.dataTransfer.files?.[0]; if (f) void processar(f); }}
      className={`space-y-3 rounded-2xl border-2 border-dashed p-4 ${sobre ? "border-accent bg-muted" : "border-border bg-card"}`}
    >
      <p className="flex items-center gap-2 text-xl font-bold"><Mail size={26} strokeWidth={2.2} /> Colar e-mail da agência</p>
      <ol className="space-y-1 text-base text-muted-foreground">
        <li>1. Abra o e-mail da agência no seu e-mail (Mail, Gmail…).</li>
        <li>2. Toque e segure o texto até aparecer "Copiar" e toque em Copiar.</li>
        <li>3. Volte aqui, toque na caixa abaixo e escolha "Colar".</li>
        <li>4. Toque em "Ler texto".</li>
      </ol>
      <p className="text-base text-muted-foreground">Preferir, toque em "Arquivo" e escolha o e-mail salvo como .eml, um PDF ou um print da confirmação. Lemos só voos, passageiros, assentos e bagagem — preços e pagamento são ignorados.</p>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} placeholder="Cole aqui o e-mail da agência" aria-label="Texto do e-mail" className="w-full rounded-xl border-2 border-input bg-background p-3 text-lg" />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={!online || lendo || !texto.trim()} onClick={() => void processar()} className="gradient-hero tap flex items-center justify-center gap-2 rounded-xl text-lg font-bold disabled:opacity-50">
          {lendo ? <Loader2 className="animate-spin" size={24} /> : <Mail size={24} strokeWidth={2.2} />} {lendo ? "Lendo…" : "Ler texto"}
        </button>
        <button type="button" disabled={!online || lendo} onClick={() => input.current?.click()} className="tap flex items-center justify-center gap-2 rounded-xl border-2 border-border text-lg font-bold disabled:opacity-50">
          <Upload size={24} strokeWidth={2.2} /> Arquivo
        </button>
      </div>
      {!online && <p className="text-base font-semibold">Sem internet · a leitura precisa de conexão.</p>}
      <input ref={input} hidden type="file" accept=".eml,message/rfc822,text/plain,text/html,image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void processar(f); }} />
    </section>
  );
}
