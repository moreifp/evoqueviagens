import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { novoId } from "./itens";

/** Recibo novo mora no storage (bucket privado "documentos"); o antigo, em data URL na própria despesa. */
export const ehReciboStorage = (p: string | null | undefined): p is string => !!p && p.startsWith("trip/");

const extensao = (tipo: string) => (tipo.includes("png") ? "png" : tipo.includes("heic") ? "heic" : tipo.includes("pdf") ? "pdf" : "jpg");

/** Sobe o recibo e devolve o caminho. Sem internet (ou se falhar) devolve null: quem chama guarda em data URL. */
export async function subirRecibo(tripId: string, expenseId: string, arquivo: Blob): Promise<string | null> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return null;
  const tipo = arquivo.type || "image/jpeg";
  const caminho = `trip/${tripId}/despesas/${expenseId}/${novoId()}.${extensao(tipo)}`;
  const { error } = await supabase.storage.from("documentos").upload(caminho, arquivo, { contentType: tipo, upsert: false });
  if (error) {
    console.warn("recibo upload", error.message);
    return null;
  }
  return caminho;
}

/** Endereço para mostrar o recibo: URL assinada (10 min) ou, no formato antigo, a data URL lida só desta despesa. */
export const reciboUrlQuery = (expenseId: string, reciboPath: string | null | undefined) =>
  queryOptions({
    queryKey: ["recibo_url", expenseId, ehReciboStorage(reciboPath) ? reciboPath : "antigo"],
    staleTime: 9 * 60_000,
    queryFn: async (): Promise<string | null> => {
      if (ehReciboStorage(reciboPath)) {
        const { data, error } = await supabase.storage.from("documentos").createSignedUrl(reciboPath, 600);
        if (error) throw new Error(error.message);
        return data.signedUrl;
      }
      const { data, error } = await supabase.from("expense").select("comprovante_url").eq("id", expenseId).maybeSingle();
      if (error) throw new Error(error.message);
      return data?.comprovante_url ?? null;
    },
  });
