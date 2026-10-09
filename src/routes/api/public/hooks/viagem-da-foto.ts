import { createFileRoute } from "@tanstack/react-router";

/**
 * Usado pelo Evoque Restaurants (backup-original) para saber em que pasta do Drive guardar o original
 * de uma foto tirada com o Restaurants aberto DENTRO do Viagens.
 * Entrada: { email, data: "AAAA-MM-DD" }. Autorização: header x-evoque-secret = RESTAURANTS_SSO_SECRET.
 * Saída: { pasta: "<nome da pasta da viagem no Drive>" } se a pessoa ORGANIZA uma viagem que inclui a data;
 * senão { pasta: null }. Não devolve nenhum outro dado da viagem.
 */
function igual(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Mesmo nome de pasta que o Viagens usa (drive.functions.ts → nomeDaViagem). */
export function nomePastaViagem(nome: string | null | undefined) {
  return ((nome as string) || "Viagem").replace(/[\\/:*?"<>|']/g, "-").trim() || "Viagem";
}

export const Route = createFileRoute("/api/public/hooks/viagem-da-foto")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const segredo = process.env["RESTAURANTS_SSO_SECRET"] ?? "";
        if (!segredo || !igual(request.headers.get("x-evoque-secret") ?? "", segredo)) return new Response("Unauthorized", { status: 401 });
        const corpo = (await request.json().catch(() => ({}))) as { email?: unknown; data?: unknown };
        const email = typeof corpo.email === "string" ? corpo.email.trim().toLowerCase() : "";
        const data = typeof corpo.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(corpo.data) ? corpo.data : "";
        if (!email || !data) return Response.json({ erro: "dados" }, { status: 400 });

        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const { data: lista } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const user = lista?.users.find((u) => (u.email ?? "").toLowerCase() === email);
        if (!user) return Response.json({ pasta: null });

        const { data: viagens } = await db
          .from("trip")
          .select("nome,data_inicio,data_fim")
          .eq("owner_id", user.id)
          .is("deleted_at", null)
          .lte("data_inicio", data)
          .gte("data_fim", data)
          .order("data_inicio", { ascending: false })
          .limit(1);
        const v = viagens?.[0];
        return Response.json({ pasta: v ? nomePastaViagem(v.nome as string) : null });
      },
    },
  },
});
