ALTER TABLE public.ticket ADD COLUMN IF NOT EXISTS bag_mao_qtd integer, ADD COLUMN IF NOT EXISTS bag_mao_kg numeric, ADD COLUMN IF NOT EXISTS item_pessoal boolean, ADD COLUMN IF NOT EXISTS bag_desp_qtd integer, ADD COLUMN IF NOT EXISTS bag_desp_kg numeric;
ALTER TABLE public.ticket_passenger ADD COLUMN IF NOT EXISTS bag_mao_qtd integer, ADD COLUMN IF NOT EXISTS bag_mao_kg numeric, ADD COLUMN IF NOT EXISTS item_pessoal boolean, ADD COLUMN IF NOT EXISTS bag_desp_qtd integer, ADD COLUMN IF NOT EXISTS bag_desp_kg numeric;
ALTER TABLE public.expense ADD COLUMN IF NOT EXISTS taxa_fonte text, ADD COLUMN IF NOT EXISTS taxa_data date;

CREATE TABLE public.person_item_dispensa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.person(id),
  item text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX person_item_dispensa_ativo ON public.person_item_dispensa(person_id, item) WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_item_dispensa TO authenticated;
GRANT ALL ON public.person_item_dispensa TO service_role;
ALTER TABLE public.person_item_dispensa ENABLE ROW LEVEL SECURITY;
CREATE POLICY pid_sel ON public.person_item_dispensa FOR SELECT TO authenticated USING (app_private.owns_person(person_id));
CREATE POLICY pid_ins ON public.person_item_dispensa FOR INSERT TO authenticated WITH CHECK (app_private.owns_person(person_id));
CREATE POLICY pid_upd ON public.person_item_dispensa FOR UPDATE TO authenticated USING (app_private.owns_person(person_id)) WITH CHECK (app_private.owns_person(person_id));
CREATE POLICY pid_del ON public.person_item_dispensa FOR DELETE TO authenticated USING (app_private.owns_person(person_id));

ALTER TABLE public.item_attachment ADD COLUMN IF NOT EXISTS privado boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION app_private.can_view_attachment(_tipo text, _item uuid, _privado boolean) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE b record;
BEGIN
  IF NOT _privado THEN RETURN app_private.can_view_item_detail(_tipo, _item); END IF;
  SELECT * INTO b FROM app_private.item_base(_tipo, _item);
  RETURN b.trip_id IS NOT NULL AND app_private.owns_trip(b.trip_id);
END $$;

DROP POLICY IF EXISTS ia_read ON public.item_attachment;
CREATE POLICY ia_read ON public.item_attachment FOR SELECT TO authenticated USING (app_private.can_view_attachment(item_tipo, item_id, privado));

CREATE OR REPLACE FUNCTION app_private.can_view_file(_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _pid uuid; _seg text; _tipo text; _item uuid; _priv boolean;
BEGIN
  _seg := split_part(_name, '/', 1);
  IF _seg = 'trip' THEN
    SELECT item_tipo, item_id, privado INTO _tipo, _item, _priv FROM public.item_attachment WHERE storage_path = _name AND deleted_at IS NULL ORDER BY privado DESC LIMIT 1;
    IF _item IS NULL THEN RETURN false; END IF;
    RETURN app_private.can_view_attachment(_tipo, _item, _priv);
  END IF;
  IF _seg !~ '^[0-9a-f-]{36}$' THEN RETURN false; END IF;
  _pid := _seg::uuid;
  IF EXISTS (SELECT 1 FROM public.document_attachment d WHERE d.person_id = _pid AND d.storage_path = _name AND d.deleted_at IS NULL) THEN
    RETURN app_private.can_view(_pid, 'documentos');
  END IF;
  IF EXISTS (SELECT 1 FROM public.traveler_document d WHERE d.person_id = _pid AND d.arquivo_path = _name AND d.deleted_at IS NULL) THEN
    RETURN app_private.can_view(_pid, 'documentos');
  END IF;
  IF EXISTS (SELECT 1 FROM public.person p WHERE p.id = _pid AND p.foto_url = _name AND p.deleted_at IS NULL) THEN
    RETURN app_private.can_view(_pid, 'basico');
  END IF;
  IF EXISTS (SELECT 1 FROM public.loyalty_account l WHERE l.person_id = _pid AND l.cartao_path = _name AND l.deleted_at IS NULL) THEN
    RETURN app_private.can_view(_pid, 'fidelidade');
  END IF;
  RETURN false;
END $$;