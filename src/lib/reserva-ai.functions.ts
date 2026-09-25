import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gatewayFetch } from "./ai-gateway.server";

const input = z.object({
  texto: z.string().max(100_000).nullable(),
  arquivo: z.string().max(12_000_000).nullable(),
  nome: z.string().max(160).nullable(),
  mime: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]).nullable(),
});

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    tipo: { type: "string", enum: ["voo", "trem", "onibus", "hotel", "carro", "passeio", "restaurante", "outro"] },
    titulo: { type: ["string", "null"] }, companhia: { type: ["string", "null"] }, numero: { type: ["string", "null"] },
    localizador: { type: ["string", "null"] }, origem_iata: { type: ["string", "null"] }, destino_iata: { type: ["string", "null"] },
    origem_cidade: { type: ["string", "null"] }, destino_cidade: { type: ["string", "null"] }, inicio: { type: ["string", "null"] },
    fim: { type: ["string", "null"] }, local: { type: ["string", "null"] }, cidade: { type: ["string", "null"] },
    valor: { type: ["number", "null"] }, moeda: { type: ["string", "null"] }, cancelamento_gratis_ate: { type: ["string", "null"] },
  },
  required: ["tipo", "titulo", "companhia", "numero", "localizador", "origem_iata", "destino_iata", "origem_cidade", "destino_cidade", "inicio", "fim", "local", "cidade", "valor", "moeda", "cancelamento_gratis_ate"],
};

function safeMessage(status: number, body: string) {
  try { const j = JSON.parse(body) as { message?: string; error?: { message?: string } }; return j.message ?? j.error?.message ?? `A leitura falhou (${status}).`; }
  catch { return `A leitura falhou (${status}).`; }
}

export const extrairReserva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("A leitura automática não está configurada.");
    if (!data.texto?.trim() && !data.arquivo) throw new Error("Escolha um arquivo ou cole um texto.");
    const content: Record<string, unknown>[] = [{ type: "input_text", text: "Extraia os dados desta reserva de viagem. Não adivinhe. Datas devem ser ISO local YYYY-MM-DDTHH:mm e data simples YYYY-MM-DD. Retorne somente os campos do schema." }];
    if (data.texto?.trim()) content.push({ type: "input_text", text: data.texto.trim() });
    if (data.arquivo && data.mime?.startsWith("image/")) content.push({ type: "input_image", image_url: data.arquivo });
    if (data.arquivo && data.mime === "application/pdf") content.push({ type: "input_file", filename: data.nome ?? "reserva.pdf", file_data: data.arquivo });
    const run = gatewayFetch();
    const response = await run.fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash", stream: true,
        input: [{ role: "user", content }],
        reasoning: { effort: "low", summary: "auto" }, store: false, include: ["reasoning.encrypted_content"],
        text: { format: { type: "json_schema", name: "reserva_viagem", strict: true, schema } },
      }),
    });
    if (!response.ok) throw new Error(safeMessage(response.status, await response.text()));
    if (!response.body) throw new Error("A leitura terminou sem resposta.");
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let output = "";
    while (true) {
      const next = await reader.read(); if (next.done) break; buffer += decoder.decode(next.value, { stream: true });
      const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
      for (const line of lines) if (line.startsWith("data: ")) {
        const raw = line.slice(6); if (raw === "[DONE]") continue;
        try { const event = JSON.parse(raw) as { type?: string; delta?: string }; if (event.type === "response.output_text.delta") output += event.delta ?? ""; } catch { /* parcial */ }
      }
    }
    if (!output.trim()) throw new Error("Não consegui identificar os dados. Escolha o tipo e preencha manualmente.");
    return z.object({ tipo: z.enum(["voo", "trem", "onibus", "hotel", "carro", "passeio", "restaurante", "outro"]), titulo: z.string().nullable(), companhia: z.string().nullable(), numero: z.string().nullable(), localizador: z.string().nullable(), origem_iata: z.string().nullable(), destino_iata: z.string().nullable(), origem_cidade: z.string().nullable(), destino_cidade: z.string().nullable(), inicio: z.string().nullable(), fim: z.string().nullable(), local: z.string().nullable(), cidade: z.string().nullable(), valor: z.number().nullable(), moeda: z.string().nullable(), cancelamento_gratis_ate: z.string().nullable() }).parse(JSON.parse(output));
  });
