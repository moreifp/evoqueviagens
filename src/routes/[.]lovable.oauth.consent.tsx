import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Resp = {
  data: { client?: { name?: string }; redirect_url?: string; redirect_to?: string } | null;
  error: { message: string } | null;
};
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<Resp>;
  approveAuthorization: (id: string) => Promise<Resp>;
  denyAuthorization: (id: string) => Promise<Resp>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Autorizar acesso — Evoque Viagens" },
      { name: "description", content: "Autorize um assistente a propor itens nas suas viagens." },
      { property: "og:title", content: "Autorizar acesso — Evoque Viagens" },
      {
        property: "og:description",
        content: "Autorize um assistente a propor itens nas suas viagens.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  loaderDeps: ({ search }) => ({ id: search.authorization_id }),
  loader: async ({ deps }) => {
    if (!deps.id) throw new Error("Pedido de autorização sem identificador.");
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return null; // o login do app aparece por cima e volta para cá
    const { data, error } = await oauth().getAuthorizationDetails(deps.id);
    if (error) throw new Error(error.message);
    const imediato = data?.redirect_url ?? data?.redirect_to;
    if (imediato && !data?.client) throw redirect({ href: imediato });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-md p-6 text-lg">
      Não deu para abrir este pedido: {String((error as Error)?.message ?? error)}
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const nome = details?.client?.name ?? "o assistente";

  async function decidir(aprovar: boolean) {
    setBusy(true);
    const { data, error } = aprovar
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setErro(error.message);
      return;
    }
    const alvo = data?.redirect_url ?? data?.redirect_to;
    if (!alvo) {
      setBusy(false);
      setErro("Não veio o endereço de volta. Tente de novo.");
      return;
    }
    window.location.href = alvo;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 p-6">
      <h1 className="font-display text-3xl font-semibold text-foreground">
        Conectar {nome} ao Evoque Viagens
      </h1>
      <p className="text-lg text-foreground">
        {nome} vai poder ver suas viagens e participantes e propor voos, hotéis e reservas. Nada
        entra direto: tudo fica pendente até você confirmar. Documentos e cofre nunca vão.
      </p>
      {erro && (
        <p role="alert" className="text-lg text-destructive">
          {erro}
        </p>
      )}
      <button
        disabled={busy}
        onClick={() => decidir(true)}
        className="min-h-14 rounded-xl bg-primary px-6 text-lg font-semibold text-primary-foreground"
      >
        Permitir
      </button>
      <button
        disabled={busy}
        onClick={() => decidir(false)}
        className="min-h-14 rounded-xl border border-border px-6 text-lg font-semibold text-foreground"
      >
        Recusar
      </button>
    </main>
  );
}
