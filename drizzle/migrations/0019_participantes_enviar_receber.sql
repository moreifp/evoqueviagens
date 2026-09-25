ALTER TABLE public.trip_member
  ADD COLUMN IF NOT EXISTS convite_email text,
  ADD COLUMN IF NOT EXISTS convite_telefone text,
  ADD COLUMN IF NOT EXISTS convite_idioma text NOT NULL DEFAULT 'pt',
  ADD COLUMN IF NOT EXISTS lembrado_em timestamptz;
CREATE INDEX IF NOT EXISTS trip_member_convite_email_idx ON public.trip_member (lower(convite_email)) WHERE deleted_at IS NULL;

-- Status do participante decidido no banco.
CREATE OR REPLACE FUNCTION app_private.trip_member_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _dono uuid; p record;
BEGIN
  IF NEW.papel = 'owner' THEN RETURN NEW; END IF;
  SELECT owner_id INTO _dono FROM public.trip WHERE id = NEW.trip_id;
  SELECT account_id, kind INTO p FROM public.person WHERE id = NEW.person_id;
  NEW.convidado_por := coalesce(NEW.convidado_por, auth.uid(), _dono);
  IF p.kind = 'precadastro' THEN
    NEW.status := 'convidado';
  ELSIF p.account_id = _dono THEN
    NEW.status := 'aceito'; NEW.respondido_em := coalesce(NEW.respondido_em, now());
  ELSIF p.account_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.trip_trust t WHERE t.account_id = p.account_id AND t.organizer_id = _dono AND t.revogado_em IS NULL) THEN
    NEW.status := 'aceito'; NEW.respondido_em := coalesce(NEW.respondido_em, now());
  ELSE
    NEW.status := 'convidado';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trip_member_status ON public.trip_member;
CREATE TRIGGER trip_member_status BEFORE INSERT ON public.trip_member FOR EACH ROW EXECUTE FUNCTION app_private.trip_member_status();

-- Duplicar viagem numa transação só.
CREATE OR REPLACE FUNCTION public.duplicar_viagem(_origem uuid, _novo uuid, _nome text, _cidades text[], _inicio date, _fim date, _moeda text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record; r record; _rid uuid; _delta interval;
BEGIN
  IF auth.uid() IS NULL OR NOT app_private.owns_trip(_origem) THEN RAISE EXCEPTION 'Só quem organiza pode duplicar'; END IF;
  IF EXISTS (SELECT 1 FROM public.trip WHERE id = _novo) THEN RETURN _novo; END IF;
  SELECT * INTO o FROM public.trip WHERE id = _origem AND deleted_at IS NULL;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Viagem de origem não encontrada'; END IF;
  _delta := (_inicio - o.data_inicio) * interval '1 day';
  INSERT INTO public.trip(id, owner_id, nome, destino, cidades, data_inicio, data_fim, moeda_base, status)
  VALUES (_novo, auth.uid(), _nome, array_to_string(_cidades, ', '), coalesce(_cidades, '{}'), _inicio, _fim, _moeda, 'planejada');
  INSERT INTO public.trip_member(trip_id, person_id, papel, status, convidado_por, convite_email, convite_telefone, convite_idioma)
  SELECT _novo, m.person_id, m.papel, 'convidado', auth.uid(), m.convite_email, m.convite_telefone, m.convite_idioma
  FROM public.trip_member m WHERE m.trip_id = _origem AND m.deleted_at IS NULL AND m.papel <> 'owner' AND m.status <> 'recusado'
  ON CONFLICT (trip_id, person_id) DO NOTHING;
  FOR r IN SELECT * FROM public.reservation WHERE trip_id = _origem AND deleted_at IS NULL LOOP
    _rid := gen_random_uuid();
    INSERT INTO public.reservation(id, trip_id, tipo, titulo, inicio_utc, inicio_tz, fim_utc, fim_tz, local, cidade, lat, lng, localizador, valor, moeda, criado_por, origem)
    VALUES (_rid, _novo, r.tipo, r.titulo, r.inicio_utc + _delta, r.inicio_tz, r.fim_utc + _delta, r.fim_tz, r.local, r.cidade, r.lat, r.lng, r.localizador, r.valor, r.moeda, auth.uid(), r.origem);
    INSERT INTO public.reservation_person(reservation_id, person_id, papel)
    SELECT _rid, x.person_id, x.papel FROM public.reservation_person x WHERE x.reservation_id = r.id AND x.deleted_at IS NULL;
  END LOOP;
  RETURN _novo;
END $$;
REVOKE ALL ON FUNCTION public.duplicar_viagem(uuid, uuid, text, text[], date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicar_viagem(uuid, uuid, text, text[], date, date, text) TO authenticated;

-- Convidar quem ainda não tem conta.
CREATE OR REPLACE FUNCTION public.convidar_sem_conta(_trip uuid, _member uuid, _person uuid, _nome text, _email text, _telefone text, _idioma text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT app_private.owns_trip(_trip) THEN RAISE EXCEPTION 'Só quem organiza pode convidar'; END IF;
  IF coalesce(trim(_nome), '') = '' OR (coalesce(trim(_email), '') = '' AND coalesce(trim(_telefone), '') = '') THEN RAISE EXCEPTION 'Informe nome e e-mail ou WhatsApp'; END IF;
  IF EXISTS (SELECT 1 FROM public.trip_member WHERE id = _member) THEN RETURN _member; END IF;
  INSERT INTO public.person(id, nome, account_id, owner_id, kind, email, telefone, idioma)
  VALUES (_person, trim(_nome), auth.uid(), auth.uid(), 'precadastro', nullif(lower(trim(_email)), ''), nullif(trim(_telefone), ''), CASE WHEN _idioma = 'en' THEN 'en' ELSE 'pt' END);
  INSERT INTO public.trip_member(id, trip_id, person_id, papel, status, convidado_por, convite_email, convite_telefone, convite_idioma)
  VALUES (_member, _trip, _person, 'membro', 'convidado', auth.uid(), nullif(lower(trim(_email)), ''), nullif(trim(_telefone), ''), CASE WHEN _idioma = 'en' THEN 'en' ELSE 'pt' END);
  RETURN _member;
END $$;
REVOKE ALL ON FUNCTION public.convidar_sem_conta(uuid, uuid, uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convidar_sem_conta(uuid, uuid, uuid, text, text, text, text) TO authenticated;

-- Quem entra com o e-mail do convite passa a ser o participante.
CREATE OR REPLACE FUNCTION public.receber_convites_por_email()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text; _eu uuid; m record; n integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  SELECT lower(email) INTO _email FROM auth.users WHERE id = auth.uid();
  SELECT id INTO _eu FROM public.person WHERE account_id = auth.uid() AND kind = 'self' AND deleted_at IS NULL ORDER BY created_at LIMIT 1;
  IF _email IS NULL OR _eu IS NULL THEN RETURN 0; END IF;
  FOR m IN SELECT tm.* FROM public.trip_member tm JOIN public.person p ON p.id = tm.person_id
    WHERE lower(tm.convite_email) = _email AND tm.deleted_at IS NULL AND p.kind = 'precadastro' AND p.account_id <> auth.uid() LOOP
    IF NOT EXISTS (SELECT 1 FROM public.trip_member WHERE trip_id = m.trip_id AND person_id = _eu) THEN
      INSERT INTO public.trip_member(trip_id, person_id, papel, status, convidado_por, convite_email, convite_idioma)
      VALUES (m.trip_id, _eu, 'membro', 'convidado', m.convidado_por, m.convite_email, m.convite_idioma);
    END IF;
    UPDATE public.ticket_passenger SET person_id = _eu WHERE person_id = m.person_id AND ticket_id IN (SELECT id FROM public.ticket WHERE trip_id = m.trip_id);
    UPDATE public.lodging_guest SET person_id = _eu WHERE person_id = m.person_id AND room_id IN (SELECT r.id FROM public.lodging_room r JOIN public.lodging l ON l.id = r.lodging_id WHERE l.trip_id = m.trip_id);
    UPDATE public.reservation_person SET person_id = _eu WHERE person_id = m.person_id AND reservation_id IN (SELECT id FROM public.reservation WHERE trip_id = m.trip_id);
    UPDATE public.trip_member SET deleted_at = now() WHERE id = m.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.receber_convites_por_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receber_convites_por_email() TO authenticated;

-- Convites esperando resposta, com o resumo só do que é da pessoa.
CREATE OR REPLACE FUNCTION public.convites_recebidos()
RETURNS TABLE(member_id uuid, trip_id uuid, person_id uuid, pessoa text, dependente boolean, viagem text, data_inicio date, data_fim date, organizador_id uuid, organizador text, voos integer, assentos text[], hoteis integer, quartos text[], trens integer, reservas jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, t.id, p.id, coalesce(p.apelido, p.nome), p.kind = 'dependent', t.nome, t.data_inicio, t.data_fim, t.owner_id,
    coalesce((SELECT coalesce(o.apelido, o.nome) FROM public.person o WHERE o.account_id = t.owner_id AND o.kind = 'self' AND o.deleted_at IS NULL ORDER BY o.created_at LIMIT 1), 'Organizador'),
    (SELECT count(*)::int FROM public.ticket_passenger x JOIN public.ticket k ON k.id = x.ticket_id WHERE x.person_id = p.id AND x.deleted_at IS NULL AND k.trip_id = t.id AND k.deleted_at IS NULL AND k.tipo = 'voo'),
    coalesce((SELECT array_agg(DISTINCT x.assento) FROM public.ticket_passenger x JOIN public.ticket k ON k.id = x.ticket_id WHERE x.person_id = p.id AND x.deleted_at IS NULL AND k.trip_id = t.id AND k.deleted_at IS NULL AND x.assento IS NOT NULL), '{}'),
    (SELECT count(DISTINCT l.id)::int FROM public.lodging_guest g JOIN public.lodging_room r ON r.id = g.room_id JOIN public.lodging l ON l.id = r.lodging_id WHERE g.person_id = p.id AND g.deleted_at IS NULL AND r.deleted_at IS NULL AND l.trip_id = t.id AND l.deleted_at IS NULL),
    coalesce((SELECT array_agg(DISTINCT r.nome) FROM public.lodging_guest g JOIN public.lodging_room r ON r.id = g.room_id JOIN public.lodging l ON l.id = r.lodging_id WHERE g.person_id = p.id AND g.deleted_at IS NULL AND r.deleted_at IS NULL AND l.trip_id = t.id AND l.deleted_at IS NULL), '{}'),
    (SELECT count(*)::int FROM public.ticket_passenger x JOIN public.ticket k ON k.id = x.ticket_id WHERE x.person_id = p.id AND x.deleted_at IS NULL AND k.trip_id = t.id AND k.deleted_at IS NULL AND k.tipo <> 'voo'),
    coalesce((SELECT jsonb_agg(jsonb_build_object('tipo', v.tipo, 'papel', x.papel)) FROM public.reservation_person x JOIN public.reservation v ON v.id = x.reservation_id WHERE x.person_id = p.id AND x.deleted_at IS NULL AND v.trip_id = t.id AND v.deleted_at IS NULL), '[]'::jsonb)
  FROM public.trip_member m JOIN public.person p ON p.id = m.person_id JOIN public.trip t ON t.id = m.trip_id
  WHERE m.status = 'convidado' AND m.deleted_at IS NULL AND t.deleted_at IS NULL AND p.deleted_at IS NULL
    AND p.account_id = auth.uid() AND p.kind <> 'precadastro' AND t.owner_id <> auth.uid()
  ORDER BY t.data_inicio;
$$;
REVOKE ALL ON FUNCTION public.convites_recebidos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convites_recebidos() TO authenticated;

-- Quem criou o item e se eu posso editar.
CREATE OR REPLACE FUNCTION public.autoria_item(_tipo text, _id uuid)
RETURNS TABLE(autor text, sou_eu boolean, editar boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE b record; _uid uuid;
BEGIN
  IF NOT app_private.can_view_item_detail(_tipo, _id) THEN RETURN; END IF;
  SELECT * INTO b FROM app_private.item_base(_tipo, _id);
  _uid := coalesce(b.criado_por, (SELECT owner_id FROM public.trip WHERE id = b.trip_id));
  RETURN QUERY SELECT coalesce((SELECT coalesce(o.apelido, o.nome) FROM public.person o WHERE o.account_id = _uid AND o.kind = 'self' AND o.deleted_at IS NULL ORDER BY o.created_at LIMIT 1), 'Organizador'),
    _uid = auth.uid(), app_private.can_edit_item(_tipo, _id);
END $$;
REVOKE ALL ON FUNCTION public.autoria_item(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.autoria_item(text, uuid) TO authenticated;

-- Pedido de correção do participante ao organizador.
CREATE POLICY notice_pedido_ins ON public.trip_notice FOR INSERT TO authenticated
  WITH CHECK (tipo = 'pedido_correcao' AND enviado_por = auth.uid() AND person_id IS NOT NULL AND app_private.acct_person(person_id) AND app_private.can_view_trip(trip_id));