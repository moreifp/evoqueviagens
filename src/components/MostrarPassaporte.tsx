import { useEffect, useState } from "react";
import { BookUser, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { urlDoAnexo } from "@/lib/anexosOffline";
import { paisPt, type EuDocumento } from "@/lib/eu";

type Pessoa = { id: string; nome: string; docs: EuDocumento[] };
type Entrada = { chave: string; nome: string; rotulo: string; pass: EuDocumento };

const iniciais = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
const siglaPais = (v: string | null) => {
  const t = (v ?? "").trim().toUpperCase();
  return t.length === 2 ? t : t.length === 3 ? t.slice(0, 2) : t.slice(0, 3);
};

/** Lista cada passaporte como uma entrada (quem tem 2 aparece 2 vezes: "Você · IT"). */
function entradas(pessoas: Pessoa[]): Entrada[] {
  return pessoas.flatMap((p, j) => {
    const lista = p.docs.filter((d) => d.tipo === "passaporte").sort((a, b) => String(b.validade).localeCompare(String(a.validade)));
    const base = j === 0 ? "Você" : p.nome.split(" ")[0];
    return lista.map((pass) => ({ chave: pass.id, nome: p.nome, pass, rotulo: lista.length > 1 && pass.pais_emissor ? `${base} · ${siglaPais(pass.pais_emissor)}` : base }));
  });
}

/** Tela cheia do passaporte. Pode ter botão próprio ou ser aberta de fora (aberto/onFechar). */
export function MostrarPassaporte({ pessoas, aberto: abertoFora, onFechar, semBotao }: { pessoas: Pessoa[]; aberto?: boolean; onFechar?: () => void; semBotao?: boolean }) {
  const lista = entradas(pessoas);
  const [abertoLocal, setAbertoLocal] = useState(false);
  const aberto = abertoFora ?? abertoLocal;
  const fechar = () => { setAbertoLocal(false); onFechar?.(); };
  const [i, setI] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const atual = lista[Math.min(i, lista.length - 1)];
  useEffect(() => { if (aberto) setI(0); }, [aberto]);
  useEffect(() => {
    if (!aberto || !atual?.pass.arquivo_path) { setUrl(null); return; }
    let vivo = true;
    void urlDoAnexo(atual.pass.arquivo_path).then((u) => vivo && setUrl(u));
    return () => { vivo = false; };
  }, [aberto, atual?.pass.arquivo_path]);
  if (!lista.length) return semBotao && aberto ? <SemPassaporte fechar={fechar} /> : null;
  async function copiar() {
    if (!atual?.pass.numero) return;
    try { await navigator.clipboard.writeText(atual.pass.numero); toast.success("Número copiado"); } catch { toast.error("Não deu para copiar."); }
  }
  return (
    <>
      {!semBotao && (
        <button type="button" onClick={() => setAbertoLocal(true)} className="tap flex w-full items-center justify-center gap-2 rounded-lg border-2 border-doc-border bg-doc-soft text-lg font-bold text-foreground">
          <BookUser size={26} strokeWidth={2.2} className="text-doc" /> Mostrar passaporte
        </button>
      )}
      {aberto && atual && (
        <div role="dialog" aria-modal aria-label="Passaporte" className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-navy text-primary-foreground">
          <div className="flex justify-end p-2">
            <button type="button" onClick={fechar} aria-label="Fechar" className="tap flex size-14 items-center justify-center rounded-full"><X size={32} strokeWidth={2.4} /></button>
          </div>
          {lista.length > 1 && (
            <div className="flex gap-3 overflow-x-auto px-4 pb-3">
              {lista.map((e, j) => (
                <button key={e.chave} type="button" onClick={() => setI(j)} aria-pressed={j === i} className="flex shrink-0 flex-col items-center gap-1">
                  <span className={`flex size-14 items-center justify-center rounded-full bg-primary-foreground/15 text-lg font-bold ${j === i ? "ring-4 ring-primary-foreground ring-offset-2 ring-offset-navy" : ""}`}>{iniciais(e.nome)}</span>
                  <span className="text-sm font-bold">{e.rotulo}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex min-h-[200px] flex-1 items-center justify-center px-4">
            {url ? <img src={url} alt={`Passaporte de ${atual.nome}`} className="max-h-[45vh] max-w-full rounded-xl object-contain" /> : <p className="text-lg opacity-90">{atual.pass.arquivo_path ? "Carregando a foto…" : "Sem foto guardada."}</p>}
          </div>
          <div className="space-y-4 px-5 pb-6 pt-4">
            <div className="text-center">
              <p className="text-sm font-bold uppercase tracking-wide opacity-80">Número</p>
              <p className="mono-code num break-all text-5xl leading-tight">{atual.pass.numero ?? "—"}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-primary-foreground/10 p-3"><p className="text-sm font-bold uppercase opacity-80">País</p><p className="text-xl font-bold">{paisPt(atual.pass.pais_emissor) || "—"}</p></div>
              <div className="rounded-xl bg-primary-foreground/10 p-3"><p className="text-sm font-bold uppercase opacity-80">Validade</p><p className="num text-xl font-bold">{atual.pass.validade ? atual.pass.validade.split("-").reverse().join("/") : "—"}</p></div>
            </div>
            <div className="rounded-xl bg-primary-foreground/10 p-3"><p className="text-sm font-bold uppercase opacity-80">Nome no passaporte</p><p className="text-xl font-bold">{atual.pass.nome_no_documento || atual.nome}</p></div>
            {atual.pass.numero && (
              <button type="button" onClick={() => void copiar()} className="tap flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-foreground text-lg font-bold text-navy"><Copy size={24} strokeWidth={2.2} /> Copiar número</button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function SemPassaporte({ fechar }: { fechar: () => void }) {
  return (
    <div role="dialog" aria-modal aria-label="Passaporte" className="fixed inset-0 z-50 flex flex-col bg-navy text-primary-foreground">
      <div className="flex justify-end p-2"><button type="button" onClick={fechar} aria-label="Fechar" className="tap flex size-14 items-center justify-center"><X size={32} /></button></div>
      <p className="p-6 text-center text-xl">Nenhum passaporte guardado.</p>
    </div>
  );
}
