import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Topo } from "@/components/Chrome";
import { Campo, inputCls } from "@/components/Form";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Administradores — Evoque Viagens" },
      { name: "description", content: "Quem pode entrar e conferir os cadastros." },
      { property: "og:title", content: "Administradores — Evoque Viagens" },
      { property: "og:description", content: "Quem pode entrar e conferir os cadastros." },
    ],
  }),
  component: Perfil,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any };

function Perfil() {
  const qc = useQueryClient();
  const { data: admins = [] } = useQuery({
    queryKey: ["admins"],
    queryFn: async () => {
      const { data, error } = await db.from("app_admin").select("email, created_at").order("created_at");
      if (error) throw new Error(error.message);
      return data as { email: string }[];
    },
  });
  const { data: eu } = useQuery({ queryKey: ["eu"], queryFn: async () => (await supabase.auth.getUser()).data.user?.email ?? "" });
  const [email, setEmail] = useState("");

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await db.from("app_admin").insert({ email: email.trim().toLowerCase(), added_by: eu });
    if (error) return toast.error(error.message.includes("duplicate") ? "Esse e-mail já está na lista." : "Não deu certo agora.");
    toast.success("Adicionado. No primeiro acesso, a pessoa cria a senha.");
    setEmail("");
    qc.invalidateQueries({ queryKey: ["admins"] });
  }

  async function remover(em: string) {
    if (em === eu) return toast.error("Você não pode tirar a si mesmo.");
    await db.from("app_admin").delete().eq("email", em);
    qc.invalidateQueries({ queryKey: ["admins"] });
    toast(`${em} removido`, {
      duration: 10000,
      action: {
        label: "Desfazer",
        onClick: async () => {
          await db.from("app_admin").insert({ email: em, added_by: eu });
          qc.invalidateQueries({ queryKey: ["admins"] });
        },
      },
    });
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <Topo titulo="Administradores" voltarPara="/" />
      <main className="space-y-6 px-4 pt-4">
        <p className="text-base text-muted-foreground">Só estas pessoas entram no app. Elas veem e editam todos os cadastros.</p>
        <ul className="space-y-2">
          {admins.map((a) => (
            <li key={a.email} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2">
              <span className="flex-1 truncate text-lg font-semibold text-foreground">{a.email}</span>
              <button
                aria-label={`Remover ${a.email}`}
                onClick={() => remover(a.email)}
                className="tap flex flex-col items-center justify-center rounded-xl text-destructive"
              >
                <Trash2 size={24} strokeWidth={2.2} />
                <span className="text-sm font-bold">Remover</span>
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={adicionar} className="space-y-3">
          <Campo rotulo="E-mail do novo administrador">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </Campo>
          <button type="submit" className="gradient-hero shadow-medium tap flex w-full items-center justify-center gap-2 rounded-2xl text-xl font-bold">
            <Plus size={26} strokeWidth={2.2} />
            Adicionar
          </button>
        </form>
      </main>
    </div>
  );
}
