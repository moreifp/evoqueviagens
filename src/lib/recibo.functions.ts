import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Transcreve a foto de um recibo em texto organizado e legível.
 * Mesma ideia da leitura de documentos: a foto vai cheia para a IA,
 * que devolve o conteúdo da conta como texto fácil de ler em tela pequena.
 */
export const transcreverRecibo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ imagem: z.string().max(8_000_000) }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false as const, erro: "config" };
    const prompt = `Transcreva esta foto de recibo, conta ou nota fiscal. Escreva em português um texto organizado e legível, assim:
1. Estabelecimento (nome; endereço e CNPJ só se estiverem visíveis)
2. Data e hora
3. Cada item da conta, uma linha por item, com quantidade, descrição e valor (ex.: "2 · Água 500ml · R$ 12,00")
4. Subtotal, taxa de serviço e descontos, se existirem
5. Total
6. Forma de pagamento e valor pago (ex.: "Cartão final 1234 · R$ 340,00")

Regras: transcreva apenas o que estiver visível, nunca invente valores ou itens. Se uma linha estiver ilegível, escreva (ilegível). Se não for um recibo, responda "Esta foto não parece uma conta ou recibo.". Devolva apenas o texto, sem comentários.`;
    try {
      // Mesmo modelo da leitura de documentos: muito mais barato que o modelo
      // de raciocínio e suficiente para transcrever uma conta.
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: data.imagem } },
          ] }],
        }),
      });
      if (!r.ok) {
        const msg = await r.text().catch(() => "");
        return { ok: false as const, erro: msg.slice(0, 300) || `erro ${r.status}` };
      }
      const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
      const texto = (j.choices?.[0]?.message?.content ?? "").trim();
      if (!texto) return { ok: false as const, erro: "vazio" };
      return { ok: true as const, texto: texto.slice(0, 20_000) };
    } catch (e) {
      return { ok: false as const, erro: e instanceof Error ? e.message.slice(0, 300) : "erro" };
    }
  });
