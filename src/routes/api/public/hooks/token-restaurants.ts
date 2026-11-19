import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { montarTokenRestaurants } from "@/lib/restaurants.functions";

/**
 * Token SSO do Restaurants embutido, por uma rota simples (sem a maquinaria das
 * funções de servidor). O app manda o token de login que já está guardado no
 * aparelho — sem passar pela trava de sessão do SDK, que no iPhone às vezes fica
 * presa e deixava a aba Restaurantes sem abrir.
 * Entrada: Authorization: Bearer <access_token do Supabase>. Saída: { token, clientId, url } ou { erro }.
 */
export const Route = createFileRoute("/api/public/hooks/token-restaurants")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ini = Date.now();
        const jwt = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
        if (!jwt) return Response.json({ erro: "sem_login" }, { status: 401 });
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key) return Response.json({ erro: "nao_configurado" }, { status: 500 });
        const supabase = createClient(url, key, {
          global: { headers: { Authorization: `Bearer ${jwt}`, apikey: key } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await supabase.auth.getUser(jwt);
        if (error || !data.user) {
          console.warn(
            `[token-restaurants] login recusado em ${Date.now() - ini} ms: ${error?.message ?? "sem usuário"}`,
          );
          return Response.json({ erro: "sessao_vencida" }, { status: 401 });
        }
        const r = await montarTokenRestaurants(supabase, data.user);
        if ("erro" in r) console.warn(`[token-restaurants] ${r.erro}`);
        return Response.json(r, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
