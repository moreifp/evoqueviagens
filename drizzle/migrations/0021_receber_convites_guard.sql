CREATE OR REPLACE FUNCTION app_private.trip_member_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF auth.uid() IS NULL OR app_private.owns_trip(OLD.trip_id) OR current_setting('app.receber_convite', true) = '1' THEN RETURN NEW; END IF;
  IF NEW.trip_id <> OLD.trip_id OR NEW.person_id <> OLD.person_id OR NEW.papel <> OLD.papel
     OR NEW.convidado_por IS DISTINCT FROM OLD.convidado_por OR NEW.entrou_em <> OLD.entrou_em
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     OR NEW.convite_email IS DISTINCT FROM OLD.convite_email OR NEW.convite_telefone IS DISTINCT FROM OLD.convite_telefone
     OR NEW.lembrado_em IS DISTINCT FROM OLD.lembrado_em
     OR NEW.status NOT IN ('aceito','recusado','saiu') THEN
    RAISE EXCEPTION 'Só é possível responder ao convite';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.receber_convites_por_email()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text; _eu uuid; m record; n integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  SELECT lower(email) INTO _email FROM auth.users WHERE id = auth.uid();
  SELECT id INTO _eu FROM public.person WHERE account_id = auth.uid() AND kind = 'self' AND deleted_at IS NULL ORDER BY created_at LIMIT 1;
  IF _email IS NULL OR _eu IS NULL THEN RETURN 0; END IF;
  PERFORM set_config('app.receber_convite', '1', true);
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
  PERFORM set_config('app.receber_convite', '0', true);
  RETURN n;
END $$;