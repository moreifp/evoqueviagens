// TEMPORÁRIO: exporta a lista de arquivos dos buckets com URLs assinadas (24 h). Só admin (app_admin). Apagar depois do uso.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const BUCKETS = ["documentos", "fotos-viagem"] as const;

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/admin/export-storage")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = process.env["SUPABASE_URL"]!;
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (token.split(".").length !== 3) return jsonResp({ erro: "Sem login" }, 401);

        const usuario = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              h.set("apikey", key);
              h.set("Authorization", `Bearer ${token}`);
              return fetch(input, { ...init, headers: h });
            },
          },
        });
        const { data: claims, error: e1 } = await usuario.auth.getClaims(token);
        const email = String(claims?.claims?.email ?? "").toLowerCase();
        if (e1 || !email) return jsonResp({ erro: "Login inválido" }, 401);
        // RLS de app_admin só deixa admin ler a tabela.
        const { data: adm } = await usuario.from("app_admin").select("email").ilike("email", email).maybeSingle();
        if (!adm) return jsonResp({ erro: "Só admin" }, 403);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const saida: { bucket: string; caminho: string; content_type: string | null; tamanho: number | null; url_assinada: string | null }[] = [];

        for (const bucket of BUCKETS) {
          const arquivos: { caminho: string; tipo: string | null; tamanho: number | null }[] = [];
          const pastas = [""];
          while (pastas.length) {
            const pasta = pastas.shift()!;
            for (let offset = 0; ; offset += 1000) {
              const { data, error } = await supabaseAdmin.storage.from(bucket).list(pasta, { limit: 1000, offset });
              if (error) return jsonResp({ erro: `Listar ${bucket}/${pasta}: ${error.message}` }, 500);
              for (const o of data ?? []) {
                const caminho = pasta ? `${pasta}/${o.name}` : o.name;
                if (o.id == null) pastas.push(caminho);
                else
                  arquivos.push({
                    caminho,
                    tipo: (o.metadata?.mimetype as string) ?? null,
                    tamanho: (o.metadata?.size as number) ?? null,
                  });
              }
              if (!data || data.length < 1000) break;
            }
          }
          for (let i = 0; i < arquivos.length; i += 100) {
            const lote = arquivos.slice(i, i + 100);
            const { data } = await supabaseAdmin.storage.from(bucket).createSignedUrls(lote.map((a) => a.caminho), 86_400);
            lote.forEach((a, j) =>
              saida.push({ bucket, caminho: a.caminho, content_type: a.tipo, tamanho: a.tamanho, url_assinada: data?.[j]?.signedUrl ?? null }),
            );
          }
        }
        return jsonResp({ gerado_em: new Date().toISOString(), total: saida.length, objetos: saida });
      },
    },
  },
});
