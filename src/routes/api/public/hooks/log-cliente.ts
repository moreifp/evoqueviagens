import { createFileRoute } from "@tanstack/react-router";

/**
 * Registro curto de falhas no aparelho (só onde e por quê, sem dados da pessoa),
 * para aparecer no log do Cloudflare quando algo não abre no iPhone.
 */
export const Route = createFileRoute("/api/public/hooks/log-cliente")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const corpo = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const limpa = (v: unknown) =>
          String(v ?? "")
            .replace(/[\r\n]+/g, " ")
            .slice(0, 300);
        console.error(
          `[cliente] ${limpa(corpo["onde"])}: ${limpa(corpo["erro"])} | ${limpa(corpo["detalhe"])} | ua=${limpa(request.headers.get("user-agent")).slice(0, 160)}`,
        );
        return new Response(null, { status: 204 });
      },
    },
  },
});
