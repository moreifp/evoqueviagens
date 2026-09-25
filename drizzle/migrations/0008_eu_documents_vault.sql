ALTER TABLE public.loyalty_account ADD COLUMN IF NOT EXISTS titular text;
ALTER TABLE public.loyalty_account ADD COLUMN IF NOT EXISTS site_url text;
ALTER TABLE public.loyalty_account ADD COLUMN IF NOT EXISTS cartao_path text;
COMMENT ON COLUMN public.loyalty_account.cartao_path IS 'Foto opcional do cartão; acesso segue o bloco fidelidade';

CREATE TABLE public.document_attachment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.traveler_document(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.person(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_attachment TO authenticated;
GRANT ALL ON public.document_attachment TO service_role;
ALTER TABLE public.document_attachment ENABLE ROW LEVEL SECURITY;
CREATE POLICY document_attachment_read ON public.document_attachment FOR SELECT TO authenticated
  USING (app_private.can_view(person_id, 'documentos'));
CREATE POLICY document_attachment_insert ON public.document_attachment FOR INSERT TO authenticated
  WITH CHECK (app_private.owns_person(person_id) AND EXISTS (
    SELECT 1 FROM public.traveler_document d WHERE d.id = document_id AND d.person_id = person_id
  ));
CREATE POLICY document_attachment_update ON public.document_attachment FOR UPDATE TO authenticated
  USING (app_private.owns_person(person_id))
  WITH CHECK (app_private.owns_person(person_id) AND EXISTS (
    SELECT 1 FROM public.traveler_document d WHERE d.id = document_id AND d.person_id = person_id
  ));
CREATE POLICY document_attachment_delete ON public.document_attachment FOR DELETE TO authenticated
  USING (app_private.owns_person(person_id));
CREATE UNIQUE INDEX document_attachment_one_primary
  ON public.document_attachment(document_id) WHERE is_primary AND deleted_at IS NULL;
CREATE INDEX document_attachment_document_idx ON public.document_attachment(document_id, created_at) WHERE deleted_at IS NULL;

INSERT INTO public.document_attachment (document_id, person_id, storage_path, file_name, content_type, is_primary)
SELECT d.id, d.person_id, d.arquivo_path,
       regexp_replace(d.arquivo_path, '^.*/', ''),
       CASE WHEN lower(d.arquivo_path) LIKE '%.pdf' THEN 'application/pdf' ELSE 'image/jpeg' END,
       true
FROM public.traveler_document d
WHERE d.arquivo_path IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.document_attachment a WHERE a.storage_path = d.arquivo_path);

CREATE TABLE public.vault_meta (
  account_id uuid PRIMARY KEY DEFAULT auth.uid(),
  kdf_salt text NOT NULL,
  kdf_iterations integer NOT NULL DEFAULT 600000 CHECK (kdf_iterations >= 600000),
  verifier_ciphertext text NOT NULL,
  verifier_iv text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_meta TO authenticated;
GRANT ALL ON public.vault_meta TO service_role;
ALTER TABLE public.vault_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY vault_meta_owner_select ON public.vault_meta FOR SELECT TO authenticated USING (account_id = auth.uid());
CREATE POLICY vault_meta_owner_insert ON public.vault_meta FOR INSERT TO authenticated WITH CHECK (account_id = auth.uid());
CREATE POLICY vault_meta_owner_update ON public.vault_meta FOR UPDATE TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());
CREATE POLICY vault_meta_owner_delete ON public.vault_meta FOR DELETE TO authenticated USING (account_id = auth.uid());

CREATE TABLE public.vault_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL DEFAULT auth.uid(),
  loyalty_account_id uuid NOT NULL REFERENCES public.loyalty_account(id) ON DELETE CASCADE,
  encrypted_payload text NOT NULL,
  iv text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, loyalty_account_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_item TO authenticated;
GRANT ALL ON public.vault_item TO service_role;
ALTER TABLE public.vault_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY vault_item_owner_select ON public.vault_item FOR SELECT TO authenticated USING (account_id = auth.uid());
CREATE POLICY vault_item_owner_insert ON public.vault_item FOR INSERT TO authenticated
  WITH CHECK (account_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.loyalty_account l JOIN public.person p ON p.id = l.person_id
    WHERE l.id = loyalty_account_id AND p.account_id = auth.uid()
  ));
CREATE POLICY vault_item_owner_update ON public.vault_item FOR UPDATE TO authenticated
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.loyalty_account l JOIN public.person p ON p.id = l.person_id
    WHERE l.id = loyalty_account_id AND p.account_id = auth.uid()
  ));
CREATE POLICY vault_item_owner_delete ON public.vault_item FOR DELETE TO authenticated USING (account_id = auth.uid());

CREATE OR REPLACE FUNCTION app_private.can_view_file(_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _pid uuid; _seg text;
BEGIN
  _seg := split_part(_name, '/', 1);
  IF _seg !~ '^[0-9a-f-]{36}$' THEN RETURN false; END IF;
  _pid := _seg::uuid;
  IF EXISTS (
    SELECT 1 FROM public.document_attachment a
    WHERE a.person_id = _pid AND a.storage_path = _name AND a.deleted_at IS NULL
  ) THEN
    RETURN app_private.can_view(_pid, 'documentos');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.traveler_document d
    WHERE d.person_id = _pid AND d.arquivo_path = _name AND d.deleted_at IS NULL
  ) THEN
    RETURN app_private.can_view(_pid, 'documentos');
  END IF;
  IF EXISTS (SELECT 1 FROM public.person p WHERE p.id = _pid AND p.foto_url = _name AND p.deleted_at IS NULL) THEN
    RETURN app_private.can_view(_pid, 'basico');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.loyalty_account l
    WHERE l.person_id = _pid AND l.cartao_path = _name AND l.deleted_at IS NULL
  ) THEN
    RETURN app_private.can_view(_pid, 'fidelidade');
  END IF;
  RETURN false;
END $$;