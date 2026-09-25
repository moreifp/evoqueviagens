import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { BedDouble, Camera, Car, FileText, Plane, Receipt, Sparkles, Ticket, TrainFront, Utensils, X } from "lucide-react";
import { toast } from "sonner";
import { extrairReserva } from "@/lib/reserva-ai.functions";

export const Route = createFileRoute("/trip/$id/adicionar")({
  head: () => ({ meta: [{ title: "Adicionar — Evoque Viagens" }, { name: "description", content: "Adicione uma reserva à viagem." }, { property: "og:title", content: "Adicionar à viagem" }, { property: "og:description", content: "Leia uma reserva ou escolha o tipo." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Adicionar,
});

const TIPOS = [
  ["Despesa", Receipt, "despesas/nova"], ["Voo", Plane, "bilhetes/novo"], ["Trem/ônibus", TrainFront, "bilhetes/novo"], ["Hotel", BedDouble, "hospedagem/nova"], ["Carro", Car, "reservas/nova"], ["Passeio/ingresso", Ticket, "reservas/nova"], ["Restaurante", Utensils, "reservas/nova"],
] as const;

function Adicionar() {
  const { id } = Route.useParams(); const navigate = useNavigate(); const extrair = useServerFn(extrairReserva); const file = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState(""); const [lendo, setLendo] = useState(false); const [mostrarTexto, setMostrarTexto] = useState(false);
  async function lerArquivo(f: File) { return new Promise<string>((resolve,reject) => { const r = new FileReader(); r.onload=()=>resolve(String(r.result)); r.onerror=()=>reject(new Error("Não consegui abrir o arquivo.")); r.readAsDataURL(f); }); }
  function destino(tipo: string) { return tipo === "hotel" ? `/trip/${id}/hospedagem/nova` : ["voo","trem","onibus"].includes(tipo) ? `/trip/${id}/bilhetes/novo` : `/trip/${id}/reservas/nova`; }
  async function analisar(escolhido?: File) {
    setLendo(true); try { const dado = escolhido ? await lerArquivo(escolhido) : null; const mime = escolhido?.type; if (escolhido && !["image/jpeg","image/png","image/webp","application/pdf"].includes(mime ?? "")) throw new Error("Use uma foto JPG, PNG, WebP ou um PDF."); const r = await extrair({ data: { texto: texto.trim() || null, arquivo: dado, nome: escolhido?.name ?? null, mime: (mime || null) as "image/jpeg" | "image/png" | "image/webp" | "application/pdf" | null } }); if (!r.titulo && !r.numero && !r.inicio && !r.localizador && !r.origem_iata) throw new Error("Não consegui ler esta reserva. Escolha o tipo abaixo; o arquivo vai junto como anexo."); sessionStorage.setItem(`evoque-import-${id}`, JSON.stringify(r)); if (escolhido) sessionStorage.setItem(`evoque-anexo-${id}`, JSON.stringify({ nome: escolhido.name, mime, data: dado })); toast.success("Leitura concluída. Confira antes de salvar."); await navigate({ to: destino(r.tipo) as never }); } catch(e) { toast.error((e as Error).message || "Não consegui ler. Escolha o tipo e preencha manualmente."); if (escolhido) { const dado = await lerArquivo(escolhido); sessionStorage.setItem(`evoque-anexo-${id}`, JSON.stringify({ nome: escolhido.name, mime: escolhido.type, data: dado })); } } finally { setLendo(false); }
  }
  return <div className="fixed inset-0 z-30 overflow-y-auto bg-background pb-8"><header className="flex items-center gap-3 p-4"><h1 className="flex-1 text-3xl">Adicionar</h1><Link to="/trip/$id" params={{ id }} aria-label="Fechar" className="tap flex items-center justify-center"><X size={34} /></Link></header><main className="mx-auto max-w-3xl space-y-6 px-4">
    <button disabled={lendo} onClick={() => file.current?.click()} className="gradient-hero min-h-32 w-full rounded-[18px] p-5 text-left"><Camera size={34} /><strong className="mt-3 block text-xl">{lendo ? "Lendo a reserva…" : "Foto ou PDF da reserva"}</strong><span className="text-lg">Bilhete, voucher ou print do WhatsApp</span></button><input ref={file} hidden type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e)=>{const f=e.target.files?.[0]; if(f) void analisar(f);}} />
    <button onClick={()=>setMostrarTexto((v)=>!v)} className="tap flex w-full items-center gap-3 rounded-[18px] border border-border bg-card px-4 text-lg font-bold"><FileText size={28} /> Colar texto</button>{mostrarTexto && <div className="space-y-2"><textarea value={texto} onChange={(e)=>setTexto(e.target.value)} rows={6} placeholder="Cole o e-mail ou mensagem" className="w-full rounded-[18px] border-2 border-input bg-card p-4 text-lg"/><button disabled={!texto.trim()||lendo} onClick={()=>void analisar()} className="tap w-full rounded-lg bg-primary text-lg font-bold text-primary-foreground">Ler texto</button></div>}
    <div className="rounded-[18px] border border-border bg-card p-4"><p className="flex items-center gap-2 text-lg font-bold"><Sparkles size={24} /> Pelo Claude</p><p className="mt-1 text-base text-muted-foreground">Em breve: peça ao Claude para trazer as reservas do seu e-mail.</p></div>
    <div className="grid grid-cols-2 gap-3">{TIPOS.map(([rotulo,Icone,path])=><Link key={rotulo} to={`/trip/$id/${path}` as never} params={{id} as never} className="tap flex min-h-28 flex-col items-start justify-between rounded-[18px] border border-border bg-card p-4"><Icone size={30} className="text-accent"/><strong className="text-lg">{rotulo}</strong></Link>)}</div>
  </main></div>;
}
