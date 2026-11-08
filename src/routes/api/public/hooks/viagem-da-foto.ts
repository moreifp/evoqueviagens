import { createFileRoute } from "@tanstack/react-router";

/**
 * Usado pelo Evoque Restaurants (backup-original) para saber em que pasta do Drive guardar o original
 * de uma foto tirada com o Restaurants aberto DENTRO do Viagens.
 * Entrada: { email, data: "AAAA-MM-DD", trip_id? }. Autorização: header x-evoque-secret = RESTAURANTS_SSO_SECRET.
 * Saída: { pasta: "<nome da pasta da viagem no Drive>" } — a viagem trip_id (se a pessoa a organiza; é a
 * viagem em que o Restaurants estava aberto) ou, sem trip_id, a viagem da pessoa que inclui a data;
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
        const corpo = (await request.json().catch(() => ({}))) as { email?: unknown; data?: unknown; trip_id?: unknown };
        const email = typeof corpo.email === "string" ? corpo.email.trim().toLowerCase() : "";
        const data = typeof corpo.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(corpo.data) ? corpo.data : "";
        const tripId = typeof corpo.trip_id === "string" && /^[0-9a-f-]{36}$/i.test(corpo.trip_id) ? corpo.trip_id : "";
        if (!email || (!data && !tripId)) return Response.json({ erro: "dados" }, { status: 400 });

        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const { data: lista } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const user = lista?.users.find((u) => (u.email ?? "").toLowerCase() === email);
        if (!user) return Response.json({ pasta: null });

        // Viagem em que o Restaurants estava aberto dentro do Viagens: vale ela, seja qual for a data.
        if (tripId) {
          const { data: v } = await db.from("trip").select("nome").eq("id", tripId).eq("owner_id", user.id).is("deleted_at", null).maybeSingle();
          if (v) return Response.json({ pasta: nomePastaViagem(v.nome as string) });
          if (!data) return Response.json({ pasta: null });
        }

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
