ALTER TABLE public.person ADD COLUMN IF NOT EXISTS account_id uuid DEFAULT auth.uid();
ALTER TABLE public.person ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'dependent';
UPDATE public.person SET account_id = owner_id WHERE account_id IS NULL;
UPDATE public.person SET kind = CASE WHEN id = '6199bf79-996d-48a2-a69e-ae190a83bca1' THEN 'self' ELSE 'precadastro' END;
CREATE UNIQUE INDEX IF NOT EXISTS person_one_self ON public.person(account_id) WHERE kind = 'self' AND deleted_at IS NULL;
ALTER TABLE public.ticket ADD COLUMN IF NOT EXISTS traveler_person_id uuid REFERENCES public.person(id);
ALTER TABLE public.lodging ADD COLUMN IF NOT EXISTS traveler_person_id uuid REFERENCES public.person(id);
COMMENT ON TABLE public.app_admin IS 'DEPRECATED: substituído por contas próprias + share_grant';
COMMENT ON TABLE public.cadastro_link IS 'DEPRECATED: substituído por share_invite';

CREATE TABLE public.share_grant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  grantee_id uuid NOT NULL,
  owner_nome text,
  grantee_nome text,
  blocos text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  revogado_em timestamptz
);
CREATE UNIQUE INDEX share_grant_par ON public.share_grant(owner_id, grantee_id) WHERE status = 'ativo';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.share_grant TO authenticated;
GRANT ALL ON public.share_grant TO service_role;
ALTER TABLE public.share_grant ENABLE ROW LEVEL SECURITY;
CREATE POLICY share_grant_read ON public.share_grant FOR SELECT TO authenticated USING (owner_id = auth.uid() OR grantee_id = auth.uid());
CREATE POLICY share_grant_owner_upd ON public.share_grant FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR grantee_id = auth.uid()) WITH CHECK (owner_id = auth.uid() OR grantee_id = auth.uid());

CREATE TABLE public.share_invite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id uuid NOT NULL DEFAULT auth.uid(),
  from_nome text,
  direcao text NOT NULL DEFAULT 'pedido',
  blocos text[] NOT NULL DEFAULT '{}',
  person_id uuid REFERENCES public.person(id),
  token_hash text NOT NULL UNIQUE,
  token_cifrado text,
  expira_em timestamptz NOT NULL DEFAULT now() + interval '30 days',
  usado_em timestamptz,
  usado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.share_invite TO authenticated;
GRANT ALL ON public.share_invite TO service_role;
ALTER TABLE public.share_invite ENABLE ROW LEVEL SECURITY;
CREATE POLICY share_invite_own ON public.share_invite FOR SELECT TO authenticated USING (from_id = auth.uid());
CREATE POLICY share_invite_del ON public.share_invite FOR DELETE TO authenticated USING (from_id = auth.uid());

CREATE OR REPLACE FUNCTION app_private.owns_person(_pid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.person p where p.id = _pid and p.account_id = auth.uid())
$$;
CREATE OR REPLACE FUNCTION app_private.can_view(_pid uuid, _bloco text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.person p where p.id = _pid and p.account_id = auth.uid())
  or exists (
    select 1 from public.person p join public.share_grant g on g.owner_id = p.account_id
    where p.id = _pid and g.grantee_id = auth.uid() and g.status = 'ativo'
      and _bloco = any(g.blocos)
      and (p.kind = 'self' or (p.kind = 'dependent' and 'dependentes' = any(g.blocos)))
  )
$$;
CREATE OR REPLACE FUNCTION app_private.can_view_trip(_tid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.trip t where t.id = _tid and t.owner_id = auth.uid())
  or exists (select 1 from public.trip t join public.share_grant g on g.owner_id = t.owner_id
    where t.id = _tid and g.grantee_id = auth.uid() and g.status = 'ativo' and 'viagens' = any(g.blocos))
$$;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.owns_person(uuid), app_private.can_view(uuid, text), app_private.can_view_trip(uuid) TO authenticated;

DROP POLICY IF EXISTS person_admin ON public.person;
CREATE POLICY person_read ON public.person FOR SELECT TO authenticated USING (app_private.can_view(id, 'basico'));
CREATE POLICY person_ins ON public.person FOR INSERT TO authenticated WITH CHECK (account_id = auth.uid());
CREATE POLICY person_upd ON public.person FOR UPDATE TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());
CREATE POLICY person_del ON public.person FOR DELETE TO authenticated USING (account_id = auth.uid());

DROP POLICY IF EXISTS traveler_document_admin ON public.traveler_document;
CREATE POLICY doc_read ON public.traveler_document FOR SELECT TO authenticated USING (app_private.can_view(person_id, 'documentos'));
CREATE POLICY doc_write ON public.traveler_document FOR ALL TO authenticated USING (app_private.owns_person(person_id)) WITH CHECK (app_private.owns_person(person_id));

DROP POLICY IF EXISTS loyalty_account_admin ON public.loyalty_account;
CREATE POLICY loy_read ON public.loyalty_account FOR SELECT TO authenticated USING (app_private.can_view(person_id, 'fidelidade'));
CREATE POLICY loy_write ON public.loyalty_account FOR ALL TO authenticated USING (app_private.owns_person(person_id)) WITH CHECK (app_private.owns_person(person_id));

DROP POLICY IF EXISTS person_preferences_admin ON public.person_preferences;
CREATE POLICY pref_read ON public.person_preferences FOR SELECT TO authenticated USING (app_private.can_view(person_id, 'preferencias'));
CREATE POLICY pref_write ON public.person_preferences FOR ALL TO authenticated USING (app_private.owns_person(person_id)) WITH CHECK (app_private.owns_person(person_id));

DROP POLICY IF EXISTS person_section_review_admin ON public.person_section_review;
CREATE POLICY review_own ON public.person_section_review FOR ALL TO authenticated USING (app_private.owns_person(person_id)) WITH CHECK (app_private.owns_person(person_id));
DROP POLICY IF EXISTS person_change_admin ON public.person_change;
CREATE POLICY change_own ON public.person_change FOR ALL TO authenticated USING (app_private.owns_person(person_id)) WITH CHECK (app_private.owns_person(person_id));
DROP POLICY IF EXISTS cadastro_link_admin ON public.cadastro_link;
CREATE POLICY link_own ON public.cadastro_link FOR ALL TO authenticated USING (app_private.owns_person(person_id)) WITH CHECK (app_private.owns_person(person_id));

DROP POLICY IF EXISTS trip_own ON public.trip;
CREATE POLICY trip_read ON public.trip FOR SELECT TO authenticated USING (app_private.can_view_trip(id));
CREATE POLICY trip_write ON public.trip FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS ticket_own ON public.ticket;
CREATE POLICY ticket_read ON public.ticket FOR SELECT TO authenticated USING (app_private.can_view_trip(trip_id));
CREATE POLICY ticket_write ON public.ticket FOR ALL TO authenticated USING (app_private.owns_trip(trip_id)) WITH CHECK (app_private.owns_trip(trip_id));
DROP POLICY IF EXISTS lodging_own ON public.lodging;
CREATE POLICY lodging_read ON public.lodging FOR SELECT TO authenticated USING (app_private.can_view_trip(trip_id));
CREATE POLICY lodging_write ON public.lodging FOR ALL TO authenticated USING (app_private.owns_trip(trip_id)) WITH CHECK (app_private.owns_trip(trip_id));
DROP POLICY IF EXISTS expense_own ON public.expense;
CREATE POLICY expense_read ON public.expense FOR SELECT TO authenticated USING (app_private.can_view_trip(trip_id));
CREATE POLICY expense_write ON public.expense FOR ALL TO authenticated USING (app_private.owns_trip(trip_id)) WITH CHECK (app_private.owns_trip(trip_id));
DROP POLICY IF EXISTS trip_member_own ON public.trip_member;
CREATE POLICY trip_member_read ON public.trip_member FOR SELECT TO authenticated USING (app_private.can_view_trip(trip_id));
CREATE POLICY trip_member_write ON public.trip_member FOR ALL TO authenticated USING (app_private.owns_trip(trip_id)) WITH CHECK (app_private.owns_trip(trip_id));

DROP POLICY IF EXISTS documentos_admin_select ON storage.objects;
DROP POLICY IF EXISTS documentos_admin_insert ON storage.objects;
DROP POLICY IF EXISTS documentos_admin_delete ON storage.objects;
CREATE POLICY documentos_read ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'documentos' AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  AND (app_private.can_view(((storage.foldername(name))[1])::uuid, 'documentos') OR app_private.can_view(((storage.foldername(name))[1])::uuid, 'basico')));
CREATE POLICY documentos_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'documentos' AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' AND app_private.owns_person(((storage.foldername(name))[1])::uuid));
CREATE POLICY documentos_delete ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'documentos' AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' AND app_private.owns_person(((storage.foldername(name))[1])::uuid));