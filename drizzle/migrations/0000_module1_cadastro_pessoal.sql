-- Admins
CREATE TABLE public.app_admin (
  email text PRIMARY KEY,
  added_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.app_admin TO authenticated;
GRANT ALL ON public.app_admin TO service_role;
ALTER TABLE public.app_admin ENABLE ROW LEVEL SECURITY;
INSERT INTO public.app_admin (email, added_by) VALUES ('fausto@lumnia.dev', 'seed');

CREATE OR REPLACE FUNCTION app_private.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_admin WHERE lower(email) = lower(coalesce(auth.jwt()->>'email','')))
$$;
REVOKE ALL ON FUNCTION app_private.is_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION app_private.is_admin() TO authenticated;
GRANT USAGE ON SCHEMA app_private TO authenticated;

CREATE POLICY app_admin_read ON public.app_admin FOR SELECT TO authenticated USING (app_private.is_admin());
CREATE POLICY app_admin_insert ON public.app_admin FOR INSERT TO authenticated WITH CHECK (app_private.is_admin());
CREATE POLICY app_admin_delete ON public.app_admin FOR DELETE TO authenticated USING (app_private.is_admin());

-- Person
ALTER TABLE public.person
  ALTER COLUMN owner_id DROP NOT NULL,
  ALTER COLUMN owner_id SET DEFAULT auth.uid(),
  ADD COLUMN apelido text,
  ADD COLUMN cpf text,
  ADD COLUMN telefone text,
  ADD COLUMN email text,
  ADD COLUMN foto_url text,
  ADD COLUMN sexo text,
  ADD COLUMN endereco text,
  ADD COLUMN emergencia_nome text,
  ADD COLUMN emergencia_parentesco text,
  ADD COLUMN emergencia_telefone text,
  ADD COLUMN status text NOT NULL DEFAULT 'convidado' CHECK (status IN ('convidado','em_andamento','enviado','aprovado','correcao')),
  ADD COLUMN passo_atual int NOT NULL DEFAULT 0,
  ADD COLUMN modo text CHECK (modo IN ('rapido','completo')),
  ADD COLUMN idioma text NOT NULL DEFAULT 'pt' CHECK (idioma IN ('pt','en')),
  ADD COLUMN consentimento_em timestamptz,
  ADD COLUMN atualizado_em timestamptz NOT NULL DEFAULT now();
DROP POLICY IF EXISTS person_own ON public.person;
CREATE POLICY person_admin ON public.person FOR ALL TO authenticated USING (app_private.is_admin()) WITH CHECK (app_private.is_admin());

-- Documents
ALTER TABLE public.traveler_document
  ALTER COLUMN owner_id DROP NOT NULL,
  ALTER COLUMN owner_id SET DEFAULT auth.uid(),
  ADD COLUMN emissao date,
  ADD COLUMN nome_no_documento text,
  ADD COLUMN sexo text,
  ADD COLUMN detalhe text,
  ADD COLUMN arquivo_path text,
  ADD CONSTRAINT traveler_document_tipo_chk CHECK (tipo IN ('passaporte','visto','esta','eta_canada','eta_uk','etias','outro_visto','rg','cnh','pid','vacina','seguro','global_entry'));
DROP POLICY IF EXISTS traveler_document_own ON public.traveler_document;
CREATE POLICY traveler_document_admin ON public.traveler_document FOR ALL TO authenticated USING (app_private.is_admin()) WITH CHECK (app_private.is_admin());

-- Loyalty
ALTER TABLE public.loyalty_account
  ALTER COLUMN owner_id DROP NOT NULL,
  ALTER COLUMN owner_id SET DEFAULT auth.uid(),
  ADD COLUMN categoria text,
  ADD COLUMN tipo text NOT NULL DEFAULT 'aerea' CHECK (tipo IN ('aerea','hotel','locadora','sala_vip'));
DROP POLICY IF EXISTS loyalty_account_own ON public.loyalty_account;
CREATE POLICY loyalty_account_admin ON public.loyalty_account FOR ALL TO authenticated USING (app_private.is_admin()) WITH CHECK (app_private.is_admin());

-- Preferences
CREATE TABLE public.person_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL UNIQUE REFERENCES public.person(id),
  assento text CHECK (assento IN ('janela','corredor','tanto_faz')),
  quarto text CHECK (quarto IN ('casal','duas_camas','tanto_faz')),
  bebe_alcool boolean,
  restricoes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_preferences TO authenticated;
GRANT ALL ON public.person_preferences TO service_role;
ALTER TABLE public.person_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY person_preferences_admin ON public.person_preferences FOR ALL TO authenticated USING (app_private.is_admin()) WITH CHECK (app_private.is_admin());

-- Section review
CREATE TABLE public.person_section_review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.person(id),
  secao text NOT NULL CHECK (secao IN ('voce','passaporte','extras','vistos','fidelidade','preferencias','emergencia')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','correcao')),
  recado text,
  revisado_por text,
  revisado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (person_id, secao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_section_review TO authenticated;
GRANT ALL ON public.person_section_review TO service_role;
ALTER TABLE public.person_section_review ENABLE ROW LEVEL SECURITY;
CREATE POLICY person_section_review_admin ON public.person_section_review FOR ALL TO authenticated USING (app_private.is_admin()) WITH CHECK (app_private.is_admin());

-- Changes
CREATE TABLE public.person_change (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.person(id),
  secao text NOT NULL,
  campo text NOT NULL,
  valor_antigo text,
  valor_novo text,
  arquivo_antigo text,
  arquivo_novo text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','recusado')),
  deleted_at timestamptz
);
CREATE INDEX person_change_person_idx ON public.person_change(person_id) WHERE status = 'pendente';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_change TO authenticated;
GRANT ALL ON public.person_change TO service_role;
ALTER TABLE public.person_change ENABLE ROW LEVEL SECURITY;
CREATE POLICY person_change_admin ON public.person_change FOR ALL TO authenticated USING (app_private.is_admin()) WITH CHECK (app_private.is_admin());

-- Personal links
CREATE TABLE public.cadastro_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.person(id),
  token_hash text NOT NULL UNIQUE,
  expira_em timestamptz NOT NULL DEFAULT now() + interval '7 days',
  revogado_em timestamptz,
  criado_por text,
  ultimo_acesso_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cadastro_link TO authenticated;
GRANT ALL ON public.cadastro_link TO service_role;
ALTER TABLE public.cadastro_link ENABLE ROW LEVEL SECURITY;
CREATE POLICY cadastro_link_admin ON public.cadastro_link FOR ALL TO authenticated USING (app_private.is_admin()) WITH CHECK (app_private.is_admin());

-- Storage: documentos (bucket created separately)
CREATE POLICY documentos_admin_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documentos' AND app_private.is_admin());
CREATE POLICY documentos_admin_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documentos' AND app_private.is_admin());
CREATE POLICY documentos_admin_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documentos' AND app_private.is_admin());