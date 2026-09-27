import { supabase } from "@/integrations/supabase/client";

/** Grava na PESSOA (fonte única) o que o passaporte mostrou: nascimento, nacionalidade e nome se vazio. */
export async function salvarDadosPessoaPassaporte(
  pessoa: { id: string; data_nascimento: string | null; nacionalidades: string[]; nome_como_no_documento: string | null },
  v: { nascimento?: string | null; nacionalidade?: string | null; nome?: string | null },
) {
  const up: { data_nascimento?: string | null; nacionalidades?: string[]; nome_como_no_documento?: string } = {};
  if (v.nascimento !== undefined && (v.nascimento || null) !== pessoa.data_nascimento) up.data_nascimento = v.nascimento || null;
  const nac = (v.nacionalidade ?? "").trim().toUpperCase();
  if (nac && pessoa.nacionalidades[0] !== nac) up.nacionalidades = [nac, ...pessoa.nacionalidades.filter((n) => n !== nac)];
  if (v.nome && !pessoa.nome_como_no_documento) up.nome_como_no_documento = v.nome;
  if (!Object.keys(up).length) return;
  const r = await supabase.from("person").update(up).eq("id", pessoa.id);
  if (r.error) throw r.error;
}
