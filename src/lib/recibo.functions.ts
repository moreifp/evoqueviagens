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
      const r = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
        method: "POST",
        headers: { "Lovable-API-Key": key, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
        body: JSON.stringify({
          model: "openai/gpt-6-astra",
          stream: true,
          store: false,
          reasoning: { effort: "low", summary: "auto" },
          include: ["reasoning.encrypted_content"],
          input: [{ role: "user", content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: data.imagem },
          ] }],
        }),
      });
      if (!r.ok || !r.body) {
        const msg = await r.text().catch(() => "");
        return { ok: false as const, erro: msg.slice(0, 300) || `erro ${r.status}` };
      }
      // Lê a resposta em streaming e junta o texto final.
      const leitor = r.body.getReader();
      const dec = new TextDecoder();
      let buffer = "";
      let texto = "";
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const linha = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!linha.startsWith("data:")) continue;
          const carga = linha.slice(5).trim();
          if (!carga || carga === "[DONE]") continue;
          try {
            const ev = JSON.parse(carga) as { type?: string; delta?: string; response?: { output_text?: string } };
            if (ev.type === "response.output_text.delta" && ev.delta) texto += ev.delta;
            else if (ev.type === "response.completed" && ev.response?.output_text && !texto) texto = ev.response.output_text;
            else if (ev.type === "error") return { ok: false as const, erro: String((ev as { message?: string }).message ?? "erro").slice(0, 300) };
          } catch { /* linha parcial ou de outro tipo */ }
        }
      }
      texto = texto.trim();
      if (!texto) return { ok: false as const, erro: "vazio" };
      return { ok: true as const, texto: texto.slice(0, 20_000) };
    } catch (e) {
      return { ok: false as const, erro: e instanceof Error ? e.message.slice(0, 300) : "erro" };
    }
  });
