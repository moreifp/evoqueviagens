import { supabase } from "@/integrations/supabase/client";

/** Usuário da sessão guardada no aparelho (não vai à rede; funciona no avião). Mesmo formato de auth.getUser(). */
export async function usuarioLocal() {
  const { data } = await supabase.auth.getSession();
  return { data: { user: data.session?.user ?? null } };
}
