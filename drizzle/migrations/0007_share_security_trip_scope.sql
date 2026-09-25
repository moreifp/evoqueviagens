ALTER TABLE public.share_grant ADD COLUMN IF NOT EXISTS trip_ids uuid[];
ALTER TABLE public.share_invite ADD COLUMN IF NOT EXISTS trip_ids uuid[];
COMMENT ON COLUMN public.share_grant.trip_ids IS 'NULL = todas as viagens (inclui futuras); lista = só essas';

CREATE OR REPLACE FUNCTION app_private.share_grant_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.grantee_id IS DISTINCT FROM OLD.grantee_id THEN
    RAISE EXCEPTION 'owner_id/grantee_id são imutáveis';
  END IF;
  IF auth.uid() IS NULL OR auth.uid() = OLD.owner_id THEN
    RETURN NEW;
  END IF;
  -- quem recebe só pode revogar
  IF NEW.status <> 'revogado'
     OR NEW.blocos IS DISTINCT FROM OLD.blocos
     OR NEW.trip_ids IS DISTINCT FROM OLD.trip_ids
     OR NEW.owner_nome IS DISTINCT FROM OLD.owner_nome
     OR NEW.grantee_nome IS DISTINCT FROM OLD.grantee_nome
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Quem recebe só pode revogar';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS share_grant_guard ON public.share_grant;
CREATE TRIGGER share_grant_guard BEFORE UPDATE ON public.share_grant
FOR EACH ROW EXECUTE FUNCTION app_private.share_grant_guard();

DROP POLICY IF EXISTS share_grant_owner_upd ON public.share_grant;
CREATE POLICY share_grant_owner_upd ON public.share_grant FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY share_grant_grantee_revoke ON public.share_grant FOR UPDATE TO authenticated
  USING (grantee_id = auth.uid()) WITH CHECK (grantee_id = auth.uid() AND status = 'revogado');

CREATE OR REPLACE FUNCTION app_private.can_view_trip(_tid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.trip t where t.id = _tid and t.owner_id = auth.uid())
  or exists (select 1 from public.trip t join public.share_grant g on g.owner_id = t.owner_id
    where t.id = _tid and g.grantee_id = auth.uid() and g.status = 'ativo' and 'viagens' = any(g.blocos)
      and (g.trip_ids is null or t.id = any(g.trip_ids)))
$$;

-- foto de rosto = basico; qualquer outro arquivo = documentos
CREATE OR REPLACE FUNCTION app_private.can_view_file(_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _pid uuid; _seg text;
BEGIN
  _seg := split_part(_name, '/', 1);
  IF _seg !~ '^[0-9a-f-]{36}$' THEN RETURN false; END IF;
  _pid := _seg::uuid;
  IF app_private.can_view(_pid, 'documentos') THEN RETURN true; END IF;
  IF exists (select 1 from public.person p where p.id = _pid and p.foto_url = _name)
     AND NOT exists (select 1 from public.traveler_document d where d.person_id = _pid and d.arquivo_path = _name) THEN
    RETURN app_private.can_view(_pid, 'basico');
  END IF;
  RETURN false;
END $$;

DROP POLICY IF EXISTS documentos_read ON storage.objects;
CREATE POLICY documentos_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos' AND app_private.can_view_file(name));