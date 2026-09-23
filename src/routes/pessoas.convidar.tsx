import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Contact, Copy, Plus, Send, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Topo } from "@/components/Chrome";
import { inputCls } from "@/components/Form";
import { abrirWhatsApp, linkDaPessoa, mensagemConvite, urlDoLink } from "@/lib/links";

export const Route = createFileRoute("/pessoas/convidar")({
  head: () => ({
    meta: [
      { title: "Convidar — Evoque Viagens" },
      { name: "description", content: "Mande o link do cadastro de viagem pelo WhatsApp." },
      { property: "og:title", content: "Convidar — Evoque Viagens" },
      { property: "og:description", content: "Mande o link do cadastro de viagem pelo WhatsApp." },
    ],
  }),
  component: Convidar,
});

type Linha = { nome: string; tel: string };
type Enviado = { nome: string; tel: string; link: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any };

function Convidar() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [linhas, setLinhas] = useState<Linha[]>([{ nome: "", tel: "" }]);
  const [idioma, setIdioma] = useState<"pt" | "en">("pt");
  const [criando, setCriando] = useState(false);
  const [fila, setFila] = useState<Enviado[] | null>(null);
  const [pos, setPos] = useState(0);

  const validas = linhas.filter((l) => l.nome.trim());
  const temContatos = typeof navigator !== "undefined" && "contacts" in navigator;

  async function escolherContatos() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: { name?: string[]; tel?: string[] }[] = await (navigator as any).contacts.select(["name", "tel"], { multiple: true });
      const novos = res.map((c) => ({ nome: c.name?.[0] ?? "", tel: c.tel?.[0] ?? "" }));
      setLinhas((ls) => [...ls.filter((l) => l.nome.trim()), ...novos]);
    } catch {
      /* cancelou */
    }
  }

  async function enviar() {
    if (!validas.length || criando) return;
    setCriando(true);
    try {
      const out: Enviado[] = [];
      for (const l of validas) {
        const { data, error } = await db
          .from("person")
          .insert({ nome: l.nome.trim(), apelido: l.nome.trim().split(" ")[0], telefone: l.tel.trim() || null, idioma })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        const token = await linkDaPessoa(data.id, true);
        out.push({ nome: l.nome.trim().split(" ")[0]!, tel: l.tel, link: urlDoLink(token) });
      }
      qc.invalidateQueries({ queryKey: ["pessoas"] });
      setFila(out);
      setPos(0);
      abrirWhatsApp(out[0]!.tel || null, mensagemConvite(idioma, out[0]!.nome, out[0]!.link));
      setPos(1);
    } catch {
      toast.error("Não deu certo agora. Verifique a internet e tente de novo.");
    } finally {
      setCriando(false);
    }
  }

  if (fila) {
    const prox = fila[pos];
    return (
      <div className="min-h-screen bg-background pb-40">
        <Topo titulo="Convites" voltarPara="/" />
        <main className="space-y-3 px-4 pt-4">
          {fila.map((f, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2">
              <span className="flex-1 text-lg font-bold text-foreground">
                {f.nome} {i < pos ? "· enviado" : ""}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(f.link);
                  toast.success("Link copiado");
                }}
                className="tap flex flex-col items-center justify-center rounded-xl text-foreground"
              >
                <Copy size={24} strokeWidth={2.2} />
                <span className="text-sm font-bold">Copiar link</span>
              </button>
            </div>
          ))}
        </main>
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {prox ? (
            <button
              onClick={() => {
                abrirWhatsApp(prox.tel || null, mensagemConvite(idioma, prox.nome, prox.link));
                setPos(pos + 1);
              }}
              className="gradient-hero shadow-medium tap flex w-full items-center justify-center gap-3 rounded-2xl text-xl font-bold"
            >
              <Send size={26} strokeWidth={2.2} />
              Próximo: {prox.nome}
            </button>
          ) : (
            <button
              onClick={() => navigate({ to: "/" })}
              className="gradient-hero shadow-medium tap flex w-full items-center justify-center rounded-2xl text-xl font-bold"
            >
              Pronto
            </button>
          )}
        </div>
      </div>
    );
  }

  const exemplo = mensagemConvite(idioma, validas[0]?.nome.split(" ")[0] || (idioma === "en" ? "Carla" : "Carla"), "https://…/c/…");

  return (
    <div className="min-h-screen bg-background pb-40">
      <Topo titulo="Convidar" voltarPara="/" />
      <main className="space-y-5 px-4 pt-4">
        <div className="space-y-3">
          {linhas.map((l, i) => (
            <div key={i} className="flex items-start gap-2 rounded-2xl border border-border bg-card p-3">
              <div className="flex-1 space-y-2">
                <input
                  aria-label="Nome"
                  placeholder="Nome"
                  value={l.nome}
                  onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))}
                  className={inputCls}
                />
                <input
                  aria-label="WhatsApp"
                  placeholder="WhatsApp com DDD"
                  inputMode="tel"
                  value={l.tel}
                  onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, tel: e.target.value } : x)))}
                  className={inputCls}
                />
              </div>
              <button
                aria-label="Remover"
                onClick={() => setLinhas(linhas.length === 1 ? [{ nome: "", tel: "" }] : linhas.filter((_, j) => j !== i))}
                className="tap flex flex-col items-center justify-center rounded-xl text-muted-foreground"
              >
                <X size={26} strokeWidth={2.2} />
                <span className="text-sm font-bold">Tirar</span>
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <button
              onClick={() => setLinhas([...linhas, { nome: "", tel: "" }])}
              className="tap flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-border text-lg font-bold text-foreground"
            >
              <Plus size={24} strokeWidth={2.2} />
              Mais uma pessoa
            </button>
            {temContatos && (
              <button
                onClick={escolherContatos}
                className="tap flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-border text-lg font-bold text-foreground"
              >
                <Contact size={24} strokeWidth={2.2} />
                Escolher dos contatos
              </button>
            )}
          </div>
        </div>

        <div>
          <p className="text-base font-bold text-foreground">Idioma da mensagem</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                ["pt", "Português"],
                ["en", "English"],
              ] as const
            ).map(([k, r]) => (
              <button
                key={k}
                aria-pressed={idioma === k}
                onClick={() => setIdioma(k)}
                className={`tap rounded-full border-2 text-lg font-bold ${
                  idioma === k ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-foreground"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-muted p-4">
          <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Mensagem</p>
          <p className="mt-1 text-lg text-foreground">{exemplo}</p>
        </div>
      </main>
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button
          disabled={!validas.length || criando}
          onClick={enviar}
          className="gradient-hero shadow-medium tap flex w-full items-center justify-center gap-3 rounded-2xl text-xl font-bold disabled:opacity-60"
        >
          <Send size={26} strokeWidth={2.2} />
          {criando ? "Preparando…" : `Enviar ${validas.length || ""} ${validas.length === 1 ? "convite" : "convites"}`}
        </button>
      </div>
    </div>
  );
}
