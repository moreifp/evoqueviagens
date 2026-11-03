import { createFileRoute } from "@tanstack/react-router";

/**
 * Usado pelo Evoque Restaurants (edge function my-trips) para montar a linha de viagens da aba Restaurantes.
 * Entrada: { email }. Autorização: header x-evoque-secret = RESTAURANTS_SSO_SECRET.
 * Saída: { viagens: [{ nome, inicio, fim }] } — só viagens que a pessoa ORGANIZA, com datas. Nada além disso.
 */
function igual(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export const Route = createFileRoute("/api/public/hooks/viagens-do-usuario")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const segredo = process.env["RESTAURANTS_SSO_SECRET"] ?? "";
        if (!segredo || !igual(request.headers.get("x-evoque-secret") ?? "", segredo)) return new Response("Unauthorized", { status: 401 });
        const corpo = (await request.json().catch(() => ({}))) as { email?: unknown };
        const email = typeof corpo.email === "string" ? corpo.email.trim().toLowerCase() : "";
        if (!email) return Response.json({ erro: "dados" }, { status: 400 });
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const { data: lista } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const user = lista?.users.find((u) => (u.email ?? "").toLowerCase() === email);
        if (!user) return Response.json({ viagens: [] });
        const { data } = await db
          .from("trip")
          .select("nome,data_inicio,data_fim")
          .eq("owner_id", user.id)
          .is("deleted_at", null)
          .not("data_inicio", "is", null)
          .order("data_inicio", { ascending: false })
          .limit(200);
        return Response.json({
          viagens: (data ?? []).map((t) => ({ nome: (t.nome as string) || "Viagem", inicio: t.data_inicio as string, fim: (t.data_fim as string) || (t.data_inicio as string) })),
        });
      },
    },
  },
});
