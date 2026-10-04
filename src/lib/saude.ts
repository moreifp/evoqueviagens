import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const entradaSaudeSchema = z.object({
  person_id: z.string().uuid(),
  tipo: z.enum(["remedio", "medico", "condicao"]),
  nome: z.string().trim().min(1, "Informe um nome.").max(160),
  dose: z.string().trim().max(160).nullable(),
  foto_data: z.string().regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/).max(1400000).nullable(),
});

export type EntradaSaude = z.infer<typeof entradaSaudeSchema> & {
  id: string;
  created_at: string;
  deleted_at: string | null;
};

export const saudeQuery = (personId: string) => queryOptions({
  queryKey: ["saude", personId],
  networkMode: "offlineFirst" as const,
  queryFn: async (): Promise<EntradaSaude[]> => {
    const { data, error } = await supabase.from("person_health_entry")
      .select("id, person_id, tipo, nome, dose, foto_data, created_at, deleted_at")
      .eq("person_id", personId).is("deleted_at", null).order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as EntradaSaude[];
  },
});