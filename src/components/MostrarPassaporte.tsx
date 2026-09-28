import { useEffect, useState } from "react";
import { BookUser, X } from "lucide-react";
import { urlDoAnexo } from "@/lib/anexosOffline";
import type { EuDocumento } from "@/lib/eu";

type Pessoa = { id: string; nome: string; docs: EuDocumento[] };

/** Botão "Mostrar passaporte": foto em tela cheia, número grande e troca de pessoa com 1 toque. */
export function MostrarPassaporte({ pessoas }: { pessoas: Pessoa[] }) {
  const comPass = pessoas.map((p) => ({ ...p, pass: p.docs.filter((d) => d.tipo === "passaporte").sort((a, b) => String(b.validade).localeCompare(String(a.validade)))[0] })).filter((p) => p.pass);
  const [aberto, setAberto] = useState(false);
  const [i, setI] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const atual = comPass[i];
  useEffect(() => {
    if (!aberto || !atual?.pass?.arquivo_path) { setUrl(null); return; }
    let vivo = true;
    void urlDoAnexo(atual.pass.arquivo_path).then((u) => vivo && setUrl(u));
    return () => { vivo = false; };
  }, [aberto, atual?.pass?.arquivo_path]);
  if (!comPass.length) return null;
  return (
    <>
      <button type="button" onClick={() => { setI(0); setAberto(true); }} className="tap flex w-full items-center justify-center gap-2 rounded-lg border-2 border-doc-border bg-doc-soft text-lg font-bold text-foreground">
        <BookUser size={26} strokeWidth={2.2} className="text-doc" /> Mostrar passaporte
      </button>
      {aberto && atual && (
        <div role="dialog" aria-modal aria-label="Passaporte" className="fixed inset-0 z-50 flex flex-col bg-primary text-primary-foreground">
          <div className="flex items-center gap-2 p-3">
            <button type="button" onClick={() => setAberto(false)} className="tap flex items-center gap-2 px-2 text-lg font-bold"><X size={28} strokeWidth={2.2} /> Fechar</button>
          </div>
          {comPass.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-3 pb-2">
              {comPass.map((p, j) => (
                <button key={p.id} type="button" onClick={() => setI(j)} aria-pressed={j === i} className={`tap shrink-0 rounded-full px-4 text-base font-bold ${j === i ? "bg-primary-foreground text-primary" : "border-2 border-primary-foreground"}`}>{j === 0 ? "Você" : p.nome.split(" ")[0]}</button>
              ))}
            </div>
          )}
          <div className="px-4 pb-2 text-center">
            <p className="text-base font-semibold opacity-90">{atual.nome}</p>
            <p className="mono-code num text-5xl leading-tight">{atual.pass!.numero ?? "Sem número"}</p>
            {atual.pass!.validade && <p className="text-lg">Válido até {atual.pass!.validade.split("-").reverse().join("/")}</p>}
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-2">
            {url ? <img src={url} alt={`Passaporte de ${atual.nome}`} className="max-h-full max-w-full object-contain" /> : <p className="text-lg opacity-90">{atual.pass!.arquivo_path ? "Carregando a foto…" : "Sem foto guardada."}</p>}
          </div>
        </div>
      )}
    </>
  );
}
