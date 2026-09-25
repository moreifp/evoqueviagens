import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Share2, LogOut, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Topo } from "@/components/Chrome";
import { pessoasQuery } from "@/lib/pessoas";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Minha conta — Evoque Viagens" },
      { name: "description", content: "Sua conta, sua ficha e com quem você compartilha." },
      { property: "og:title", content: "Minha conta — Evoque Viagens" },
      { property: "og:description", content: "Sua conta, sua ficha e com quem você compartilha." },
    ],
  }),
  component: Perfil,
});

function Perfil() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: email } = useQuery({ queryKey: ["eu"], queryFn: async () => (await supabase.auth.getUser()).data.user?.email ?? "" });
  const { data } = useQuery(pessoasQuery());
  const eu = data?.pessoas.find((p) => p.account_id === data.uid && p.kind === "self");

  async function sair() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <Topo titulo="Minha conta" voltarPara="/" />
      <main className="space-y-3 px-4 pt-4">
        <p className="text-lg text-muted-foreground">Entrou como</p>
        <p className="break-all text-xl font-bold text-foreground">{email}</p>
        {eu && (
          <Link
            to="/pessoas/$pid"
            params={{ pid: eu.id }}
            className="tap flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 text-lg font-bold text-foreground"
          >
            <UserRound size={26} strokeWidth={2.2} />
            Minha ficha
          </Link>
        )}
        <Link
          to="/compartilhamentos"
          className="tap flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 text-lg font-bold text-foreground"
        >
          <Share2 size={26} strokeWidth={2.2} />
          Compartilhamentos
        </Link>
        <button
          onClick={sair}
          className="tap flex w-full items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 text-lg font-bold text-foreground"
        >
          <LogOut size={26} strokeWidth={2.2} />
          Sair
        </button>
      </main>
    </div>
  );
}
