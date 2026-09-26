import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, FileText, Images, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { extrairReserva, type Leitura } from "@/lib/reserva-ai.functions";
import type { Membro } from "@/lib/data";

const ACEITOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
type Mime = (typeof ACEITOS)[number];

function lerDataUrl(f: Blob) {
  return new Promise<string>((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => erro(new Error("Não consegui abrir o arquivo.")); r.readAsDataURL(f); });
}

/** HEIC e outros formatos de foto viram JPEG no próprio aparelho antes de ir para a leitura. */
async function paraJpeg(f: File): Promise<Blob> {
  const bmp = await createImageBitmap(f);
  const escala = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * escala); c.height = Math.round(bmp.height * escala);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise<Blob>((ok, erro) => c.toBlob((b) => (b ? ok(b) : erro(new Error("Não consegui abrir a foto."))), "image/jpeg", 0.88));
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z ]+/g, " ").split(/\s+/).filter((x) => x.length > 1 && !["mr", "mrs", "ms", "miss", "chd", "inf", "de", "da", "do", "dos", "das", "e"].includes(x));

/** Casa um nome lido do documento com um participante (nome, apelido ou nome do documento). */
export function casarPessoa(nome: string, membros: Membro[], excluir?: Set<string>): string | null {
  const alvo = new Set(norm(nome));
  const letras = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z ]+/g, " ").split(/\s+/).filter((y) => y.length === 1);
  const iniciais = new Set(letras(nome));
  if (!alvo.size) return null;
  let melhor: { pid: string; nota: number } | null = null;
  for (const m of membros) {
    if (excluir?.has(m.person_id)) continue;
    for (const cand of [m.nome_como_no_documento, m.nome, m.apelido]) {
      if (!cand) continue;
      const t = norm(cand);
      const comuns = t.filter((x) => alvo.has(x)).length;
      // Dois nomes em comum, ou nome único dos dois lados (ex.: apelido "Gabi" lido como "Gabi").
      const base = comuns >= 2 ? comuns + 1 : comuns === 1 && t.length === 1 && alvo.size === 1 ? 1 : 0;
      // Desempate por inicial do meio ("SILVA/TESTE B" x "Teste B Silva").
      const nota = base && letras(cand).some((l) => iniciais.has(l)) ? base + 0.5 : base;
      if (nota && (!melhor || nota > melhor.nota)) melhor = { pid: m.person_id, nota };
    }
  }
  return melhor?.pid ?? null;
}

/**
 * Botão "Preencher com foto ou PDF" do topo dos formulários. Lê pela IA, entrega os campos ao formulário
 * e guarda o arquivo para ser anexado quando o item for salvo. Nunca salva sozinho.
 */
export function PreencherArquivo({ tripId, esperado, onLido, onArquivo }: {
  tripId: string;
  esperado: "voo" | "hotel" | "reserva" | "despesa";
  onLido: (r: Leitura) => void;
  /** Quando o formulário cuida do anexo (despesa), recebe o arquivo aqui em vez da fila de anexos. */
  onArquivo?: (dataUrl: string, nome: string, mime: string) => void;
}) {
  const extrair = useServerFn(extrairReserva);
  const [lendo, setLendo] = useState(false);
  const [sobre, setSobre] = useState(false);
  const [lido, setLido] = useState<"ok" | "falhou" | null>(null);
  const foto = useRef<HTMLInputElement>(null), galeria = useRef<HTMLInputElement>(null), arquivo = useRef<HTMLInputElement>(null);
  const ocupado = useRef(false);

  async function ler(f: File) {
    if (ocupado.current) return;
    ocupado.current = true; setLendo(true); setLido(null);
    let dado: string | null = null, mime: string = f.type, nome = f.name || "documento";
    const ehEml = /\.eml$/i.test(nome) || f.type === "message/rfc822";
    try {
      if (ehEml) { dado = await lerDataUrl(f); mime = "message/rfc822"; }
      else if (f.type.startsWith("image/") && !ACEITOS.includes(f.type as Mime)) { dado = await lerDataUrl(await paraJpeg(f)); mime = "image/jpeg"; nome = nome.replace(/\.\w+$/, "") + ".jpg"; }
      else if (ACEITOS.includes(f.type as Mime)) dado = await lerDataUrl(f);
      else throw new Error("Use foto (JPG, PNG, WebP), PDF ou e-mail (.eml).");
      if (dado.length > 14_000_000) throw new Error("Arquivo grande demais (máx. 10 MB).");
      // Anexa mesmo se a leitura falhar.
      if (onArquivo) onArquivo(dado, nome, mime);
      else sessionStorage.setItem(`evoque-anexo-${tripId}`, JSON.stringify({ nome, mime, data: dado }));
      if (!navigator.onLine) throw new Error("Sem internet · não deu para ler agora.");
      const r = ehEml
        ? await extrair({ data: { texto: (await f.text()).slice(0, 100_000), arquivo: null, nome, mime: null, esperado } })
        : await extrair({ data: { texto: null, arquivo: dado, nome, mime: mime as Mime, esperado } });
      if (!r.titulo && !r.numero && !r.inicio && !r.localizador && !r.valor && !r.origem_iata) throw new Error("vazio");
      onLido(r);
      setLido("ok");
      toast.success("Lemos o documento · confira");
    } catch (e) {
      setLido("falhou");
      const m = (e as Error).message;
      toast.error(m && m !== "vazio" && !m.startsWith("Não deu") ? `Não deu para ler · preencha. (${m})` : "Não deu para ler · preencha.");
    } finally {
      ocupado.current = false; setLendo(false);
    }
  }

  useEffect(() => {
    const colar = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files ?? [])][0];
      if (f) { e.preventDefault(); void ler(f); }
    };
    window.addEventListener("paste", colar);
    return () => window.removeEventListener("paste", colar);
  });

  const escolher = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void ler(f); };
  const botao = "tap flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-border bg-card text-base font-bold disabled:opacity-50";

  return (
    <section
      onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
      onDragLeave={() => setSobre(false)}
      onDrop={(e) => { e.preventDefault(); setSobre(false); const f = e.dataTransfer.files[0]; if (f) void ler(f); }}
      className={`rounded-2xl border-2 border-dashed p-3 ${sobre ? "border-accent bg-muted" : "border-border"}`}
    >
      <p className="flex items-center gap-2 text-xl font-bold">
        {lendo ? <Loader2 size={26} className="animate-spin" /> : <Sparkles size={26} className="text-accent" />}
        {lendo ? "Lendo o documento…" : "Preencher com foto, PDF ou e-mail"}
      </p>
      {lido === "ok" && <p className="mt-1 text-lg font-bold text-ok">Lemos o documento · confira os campos e salve.</p>}
      {lido === "falhou" && <p className="mt-1 text-lg font-bold text-warn-foreground">Não deu para ler · preencha. O arquivo já vai anexado.</p>}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button type="button" disabled={lendo} onClick={() => foto.current?.click()} className={botao}><Camera size={26} /> Tirar foto</button>
        <button type="button" disabled={lendo} onClick={() => galeria.current?.click()} className={botao}><Images size={26} /> Galeria</button>
        <button type="button" disabled={lendo} onClick={() => arquivo.current?.click()} className={botao}><FileText size={26} /> Arquivo</button>
      </div>
      <p className="mt-2 hidden text-base text-muted-foreground md:block">No computador: arraste o arquivo aqui ou cole (Ctrl/⌘ + V).</p>
      <input ref={foto} type="file" accept="image/*" capture="environment" className="hidden" onChange={escolher} />
      <input ref={galeria} type="file" accept="image/*" className="hidden" onChange={escolher} />
      <input ref={arquivo} type="file" accept="application/pdf,image/*,.eml,message/rfc822" className="hidden" onChange={escolher} aria-label="Arquivo para ler" />
    </section>
  );
}
