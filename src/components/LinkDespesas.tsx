import { useEffect, useState } from "react";
import { Link2, Copy, MessageCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { abrirWhatsApp } from "@/lib/links";

function tokenNovo() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Organizador: link só de leitura das despesas (sem conta). */
export function LinkDespesas({ tripId, tripNome }: { tripId: string; tripNome: string }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    void db.from("despesas_link").select("token").eq("trip_id", tripId).is("revogado_em", null).order("created_at", { ascending: false }).limit(1)
      .then(({ data }: { data: { token: string }[] | null }) => setToken(data?.[0]?.token ?? null));
  }, [tripId]);
  const url = token ? `${window.location.origin}/d/${token}` : "";
  const texto = `Despesas da viagem ${tripNome} (só para ver): ${url}`;

  async function criar() {
    setOcupado(true);
    const t = tokenNovo();
    const { error } = await db.from("despesas_link").insert({ trip_id: tripId, token: t });
    setOcupado(false);
    if (error) return toast.error("Não deu para criar o link");
    setToken(t);
  }
  async function desligar() {
    setOcupado(true);
    const { error } = await db.from("despesas_link").update({ revogado_em: new Date().toISOString() }).eq("trip_id", tripId).is("revogado_em", null);
    setOcupado(false);
    if (error) return toast.error("Não deu para desligar");
    setToken(null); toast.success("Link desligado");
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(url); toast.success("Link copiado"); } catch { toast.error("Não foi possível copiar"); }
  }

  if (token === undefined) return null;
  if (!token) return (
    <button onClick={() => void criar()} disabled={ocupado} className="tap flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-teal text-base font-bold text-foreground">
      <Link2 size={24} strokeWidth={2.2} /> Link para verem as despesas
    </button>
  );
  return (
    <section className="rounded-3xl border-2 border-teal bg-card p-4">
      <p className="flex items-center gap-2 text-base font-bold text-foreground"><Link2 size={22} strokeWidth={2.2} className="text-teal" /> Link só para ver</p>
      <p className="mt-1 text-sm text-muted-foreground">Quem tiver o link vê despesas, divisão e saldos. Não altera nada.</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button onClick={() => abrirWhatsApp(null, texto)} className="tap flex flex-col items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground"><MessageCircle size={22} strokeWidth={2.2} /> WhatsApp</button>
        <button onClick={() => void copiar()} className="tap flex flex-col items-center justify-center rounded-2xl border-2 border-primary text-sm font-bold text-foreground"><Copy size={22} strokeWidth={2.2} /> Copiar</button>
        <button onClick={() => void desligar()} disabled={ocupado} className="tap flex flex-col items-center justify-center rounded-2xl border-2 border-border text-sm font-bold text-deve"><XCircle size={22} strokeWidth={2.2} /> Desligar</button>
      </div>
    </section>
  );
}
