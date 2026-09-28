CREATE TABLE IF NOT EXISTS public.vault_document (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL DEFAULT auth.uid(),
  person_id uuid NOT NULL REFERENCES public.person(id) ON DELETE CASCADE,
  encrypted_payload text NOT NULL,
  iv text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_document TO authenticated;
GRANT ALL ON public.vault_document TO service_role;
ALTER TABLE public.vault_document ENABLE ROW LEVEL SECURITY;
CREATE POLICY vault_document_owner_select ON public.vault_document FOR SELECT TO authenticated USING (account_id = auth.uid() AND EXISTS (SELECT 1 FROM public.person p WHERE p.id = person_id AND p.account_id = auth.uid()));
CREATE POLICY vault_document_owner_insert ON public.vault_document FOR INSERT TO authenticated WITH CHECK (account_id = auth.uid() AND EXISTS (SELECT 1 FROM public.person p WHERE p.id = person_id AND p.account_id = auth.uid()));
CREATE POLICY vault_document_owner_update ON public.vault_document FOR UPDATE TO authenticated USING (account_id = auth.uid() AND EXISTS (SELECT 1 FROM public.person p WHERE p.id = person_id AND p.account_id = auth.uid())) WITH CHECK (account_id = auth.uid() AND EXISTS (SELECT 1 FROM public.person p WHERE p.id = person_id AND p.account_id = auth.uid()));
CREATE POLICY vault_document_owner_delete ON public.vault_document FOR DELETE TO authenticated USING (account_id = auth.uid() AND EXISTS (SELECT 1 FROM public.person p WHERE p.id = person_id AND p.account_id = auth.uid()));
CREATE INDEX IF NOT EXISTS vault_document_owner_person_idx ON public.vault_document(account_id, person_id, created_at DESC) WHERE deleted_at IS NULL;
COMMENT ON TABLE public.vault_document IS 'Arquivos e dados pessoais cifrados no aparelho, acessíveis somente pela conta proprietária; não são compartilhados como documentos comuns.';