CREATE OR REPLACE FUNCTION app_private.can_edit_trip_path(_name text)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _item uuid;
BEGIN
  IF split_part(_name, '/', 1) <> 'trip' THEN RETURN false; END IF;
  -- Recibos de despesa: trip/<trip_id>/despesas/<expense_id>/<arquivo> — só quem organiza.
  IF split_part(_name, '/', 3) = 'despesas' THEN
    IF split_part(_name, '/', 2) !~ '^[0-9a-f-]{36}$' OR split_part(_name, '/', 4) !~ '^[0-9a-f-]{36}$' THEN RETURN false; END IF;
    RETURN app_private.owns_trip(split_part(_name, '/', 2)::uuid);
  END IF;
  IF split_part(_name, '/', 3) !~ '^[0-9a-f-]{36}$' THEN RETURN false; END IF;
  _item := split_part(_name, '/', 3)::uuid;
  RETURN app_private.can_edit_item('ticket', _item) OR app_private.can_edit_item('lodging', _item) OR app_private.can_edit_item('reservation', _item);
END $function$;

CREATE OR REPLACE FUNCTION app_private.can_view_file(_name text)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _pid uuid; _seg text; _tipo text; _item uuid; _priv boolean;
BEGIN
  _seg := split_part(_name, '/', 1);
  IF _seg = 'trip' THEN
    IF split_part(_name, '/', 3) = 'despesas' THEN
      IF split_part(_name, '/', 2) !~ '^[0-9a-f-]{36}$' THEN RETURN false; END IF;
      RETURN app_private.can_view_trip(split_part(_name, '/', 2)::uuid)
        AND EXISTS (SELECT 1 FROM public.expense e WHERE e.recibo_path = _name AND e.trip_id = split_part(_name, '/', 2)::uuid AND e.deleted_at IS NULL);
    END IF;
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
END $function$;

CREATE OR REPLACE FUNCTION public.pacote_offline_viagem(_tid uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _aut jsonb; _conf jsonb; _tk jsonb;
BEGIN
  IF NOT app_private.can_view_trip(_tid) THEN RETURN NULL; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('tipo', r.item_tipo, 'id', r.item_id, 'autor', a.autor, 'sou_eu', a.sou_eu, 'editar', a.editar)), '[]'::jsonb)
    INTO _aut FROM public.roteiro_viagem(_tid) r CROSS JOIN LATERAL public.autoria_item(r.item_tipo, r.item_id) a WHERE r.detalhe;
  SELECT coalesce(jsonb_agg(jsonb_build_object('ticket_id', t.id, 'person_id', c.person_id, 'estado', c.estado)), '[]'::jsonb)
    INTO _conf FROM public.ticket t CROSS JOIN LATERAL public.conferencia_nomes_voo(t.id) c WHERE t.trip_id = _tid AND t.deleted_at IS NULL;
  SELECT coalesce(jsonb_agg(t.id), '[]'::jsonb) INTO _tk FROM public.ticket t WHERE t.trip_id = _tid AND t.deleted_at IS NULL;
  RETURN jsonb_build_object('autoria', _aut, 'conferencia', _conf, 'tickets', _tk);
END $function$;
REVOKE ALL ON FUNCTION public.pacote_offline_viagem(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pacote_offline_viagem(uuid) TO authenticated;