-- Módulo 2 · Viagem parte 1: passageiros, quartos, reservas, anexos por item, permissões por item.

ALTER TABLE public.trip_member
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'convidado' CHECK (status IN ('convidado','aceito','recusado','saiu')),
  ADD COLUMN IF NOT EXISTS convidado_por uuid DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS respondido_em timestamptz;

ALTER TABLE public.ticket
  ADD COLUMN IF NOT EXISTS criado_por uuid DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'ui' CHECK (origem IN ('ui','agente')),
  ADD COLUMN IF NOT EXISTS grupo_reserva text;

ALTER TABLE public.lodging
  ADD COLUMN IF NOT EXISTS criado_por uuid DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'ui' CHECK (origem IN ('ui','agente'));

ALTER TABLE public.share_invite ADD COLUMN IF NOT EXISTS trip_id uuid REFERENCES public.trip(id) ON DELETE SET NULL;
ALTER TABLE public.share_grant ADD COLUMN IF NOT EXISTS trip_id uuid REFERENCES public.trip(id) ON DELETE SET NULL;
ALTER TABLE public.share_grant ADD COLUMN IF NOT EXISTS expira_em timestamptz;

COMMENT ON COLUMN public.ticket.traveler_person_id IS 'DEPRECATED: replaced by ticket_passenger.person_id';
COMMENT ON COLUMN public.ticket.assento IS 'DEPRECATED: replaced by ticket_passenger.assento';
COMMENT ON COLUMN public.ticket.nome_no_bilhete IS 'DEPRECATED: replaced by ticket_passenger.nome_no_bilhete';
COMMENT ON COLUMN public.ticket.anexo_url IS 'DEPRECATED: replaced by item_attachment';
COMMENT ON COLUMN public.lodging.traveler_person_id IS 'DEPRECATED: replaced by lodging_room/lodging_guest';
COMMENT ON COLUMN public.lodging.anexo_url IS 'DEPRECATED: replaced by item_attachment';

CREATE TABLE public.ticket_passenger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.ticket(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.person(id),
  nome_no_bilhete text, assento text, eticket text,
  loyalty_account_id uuid REFERENCES public.loyalty_account(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE INDEX ON public.ticket_passenger(ticket_id); CREATE INDEX ON public.ticket_passenger(person_id);

CREATE TABLE public.lodging_room (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodging_id uuid NOT NULL REFERENCES public.lodging(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT 'Quarto', tipo text,
  created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE INDEX ON public.lodging_room(lodging_id);

CREATE TABLE public.lodging_guest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.lodging_room(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.person(id),
  created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE INDEX ON public.lodging_guest(room_id); CREATE INDEX ON public.lodging_guest(person_id);

CREATE TABLE public.reservation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trip(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('carro','passeio','restaurante','outro')),
  titulo text NOT NULL,
  inicio_utc timestamptz NOT NULL, inicio_tz text NOT NULL,
  fim_utc timestamptz, fim_tz text,
  local text, cidade text, lat double precision, lng double precision,
  localizador text, valor numeric, moeda character(3),
  criado_por uuid DEFAULT auth.uid(),
  origem text NOT NULL DEFAULT 'ui' CHECK (origem IN ('ui','agente')),
  created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE INDEX ON public.reservation(trip_id);

CREATE TABLE public.reservation_person (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES public.reservation(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.person(id),
  papel text,
  created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE INDEX ON public.reservation_person(reservation_id); CREATE INDEX ON public.reservation_person(person_id);

CREATE TABLE public.item_attachment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_tipo text NOT NULL CHECK (item_tipo IN ('ticket','lodging','reservation')),
  item_id uuid NOT NULL,
  storage_path text NOT NULL,
  nome text NOT NULL, content_type text NOT NULL, size_bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE INDEX ON public.item_attachment(item_tipo, item_id); CREATE INDEX ON public.item_attachment(storage_path);

CREATE TABLE public.trip_trust (
  account_id uuid NOT NULL DEFAULT auth.uid(),
  organizer_id uuid NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  revogado_em timestamptz,
  PRIMARY KEY (account_id, organizer_id)
);

CREATE TABLE public.trip_notice (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trip(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.person(id),
  tipo text NOT NULL, mensagem text NOT NULL, regra_id text,
  enviado_por uuid DEFAULT auth.uid(), enviado_em timestamptz NOT NULL DEFAULT now(),
  canal text, lido_em timestamptz, resolvido_em timestamptz
);
CREATE INDEX ON public.trip_notice(trip_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_passenger, public.lodging_room, public.lodging_guest,
  public.reservation, public.reservation_person, public.item_attachment, public.trip_trust, public.trip_notice TO authenticated;
GRANT ALL ON public.ticket_passenger, public.lodging_room, public.lodging_guest,
  public.reservation, public.reservation_person, public.item_attachment, public.trip_trust, public.trip_notice TO service_role;

CREATE OR REPLACE FUNCTION app_private.acct_person(_pid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.person p where p.id = _pid and p.account_id = auth.uid() and p.deleted_at is null)
$$;

CREATE OR REPLACE FUNCTION app_private.grant_trip(_tid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.trip t join public.share_grant g on g.owner_id = t.owner_id
    where t.id = _tid and g.grantee_id = auth.uid() and g.status = 'ativo' and 'viagens' = any(g.blocos)
      and (g.trip_ids is null or t.id = any(g.trip_ids))
      and (g.expira_em is null or g.expira_em > now()))
$$;

CREATE OR REPLACE FUNCTION app_private.can_view_trip(_tid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.trip t where t.id = _tid and t.owner_id = auth.uid())
  or exists (select 1 from public.trip_member m join public.person p on p.id = m.person_id
    where m.trip_id = _tid and m.status = 'aceito' and m.deleted_at is null and p.account_id = auth.uid())
  or app_private.grant_trip(_tid)
$$;

CREATE OR REPLACE FUNCTION app_private.can_view(_pid uuid, _bloco text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.person p where p.id = _pid and p.account_id = auth.uid())
  or exists (
    select 1 from public.person p join public.share_grant g on g.owner_id = p.account_id
    where p.id = _pid and g.grantee_id = auth.uid() and g.status = 'ativo'
      and (g.expira_em is null or g.expira_em > now())
      and _bloco = any(g.blocos)
      and (p.kind = 'self' or (p.kind = 'dependent' and 'dependentes' = any(g.blocos)))
  )
$$;

CREATE OR REPLACE FUNCTION app_private.item_base(_tipo text, _id uuid, OUT trip_id uuid, OUT criado_por uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _tipo = 'ticket' THEN SELECT t.trip_id, t.criado_por INTO trip_id, criado_por FROM public.ticket t WHERE t.id = _id;
  ELSIF _tipo = 'lodging' THEN SELECT l.trip_id, l.criado_por INTO trip_id, criado_por FROM public.lodging l WHERE l.id = _id;
  ELSIF _tipo = 'reservation' THEN SELECT r.trip_id, r.criado_por INTO trip_id, criado_por FROM public.reservation r WHERE r.id = _id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION app_private.can_edit_item(_tipo text, _id uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE b record;
BEGIN
  SELECT * INTO b FROM app_private.item_base(_tipo, _id);
  IF b.trip_id IS NULL THEN RETURN false; END IF;
  RETURN app_private.owns_trip(b.trip_id) OR (b.criado_por = auth.uid() AND app_private.can_view_trip(b.trip_id));
END $$;

CREATE OR REPLACE FUNCTION app_private.can_view_item_detail(_tipo text, _id uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE b record;
BEGIN
  SELECT * INTO b FROM app_private.item_base(_tipo, _id);
  IF b.trip_id IS NULL THEN RETURN false; END IF;
  IF app_private.owns_trip(b.trip_id) THEN RETURN true; END IF;
  IF b.criado_por = auth.uid() AND app_private.can_view_trip(b.trip_id) THEN RETURN true; END IF;
  IF app_private.grant_trip(b.trip_id) THEN RETURN true; END IF;
  IF NOT app_private.can_view_trip(b.trip_id) THEN RETURN false; END IF;
  IF _tipo = 'ticket' THEN
    RETURN exists (select 1 from public.ticket_passenger x join public.person p on p.id = x.person_id
      where x.ticket_id = _id and x.deleted_at is null and p.account_id = auth.uid());
  ELSIF _tipo = 'lodging' THEN
    RETURN exists (select 1 from public.lodging_room r join public.lodging_guest g on g.room_id = r.id
      join public.person p on p.id = g.person_id
      where r.lodging_id = _id and r.deleted_at is null and g.deleted_at is null and p.account_id = auth.uid());
  ELSE
    RETURN exists (select 1 from public.reservation_person x join public.person p on p.id = x.person_id
      where x.reservation_id = _id and x.deleted_at is null and p.account_id = auth.uid());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION app_private.room_lodging(_room uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select lodging_id from public.lodging_room where id = _room
$$;

CREATE OR REPLACE FUNCTION app_private.ticket_trip(_tid uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select trip_id from public.ticket where id = _tid
$$;

GRANT EXECUTE ON FUNCTION app_private.acct_person(uuid), app_private.grant_trip(uuid), app_private.item_base(text, uuid),
  app_private.can_edit_item(text, uuid), app_private.can_view_item_detail(text, uuid),
  app_private.room_lodging(uuid), app_private.ticket_trip(uuid) TO authenticated;

DROP POLICY IF EXISTS ticket_read ON public.ticket;
DROP POLICY IF EXISTS ticket_write ON public.ticket;
CREATE POLICY ticket_read ON public.ticket FOR SELECT TO authenticated USING (app_private.can_view_item_detail('ticket', id));
CREATE POLICY ticket_ins ON public.ticket FOR INSERT TO authenticated
  WITH CHECK (app_private.can_view_trip(trip_id) AND (criado_por = auth.uid() OR app_private.owns_trip(trip_id)));
CREATE POLICY ticket_upd ON public.ticket FOR UPDATE TO authenticated
  USING (app_private.owns_trip(trip_id) OR criado_por = auth.uid())
  WITH CHECK (app_private.can_view_trip(trip_id) AND (app_private.owns_trip(trip_id) OR criado_por = auth.uid()));
CREATE POLICY ticket_del ON public.ticket FOR DELETE TO authenticated USING (app_private.owns_trip(trip_id) OR criado_por = auth.uid());

DROP POLICY IF EXISTS lodging_read ON public.lodging;
DROP POLICY IF EXISTS lodging_write ON public.lodging;
CREATE POLICY lodging_read ON public.lodging FOR SELECT TO authenticated USING (app_private.can_view_item_detail('lodging', id));
CREATE POLICY lodging_ins ON public.lodging FOR INSERT TO authenticated
  WITH CHECK (app_private.can_view_trip(trip_id) AND (criado_por = auth.uid() OR app_private.owns_trip(trip_id)));
CREATE POLICY lodging_upd ON public.lodging FOR UPDATE TO authenticated
  USING (app_private.owns_trip(trip_id) OR criado_por = auth.uid())
  WITH CHECK (app_private.can_view_trip(trip_id) AND (app_private.owns_trip(trip_id) OR criado_por = auth.uid()));
CREATE POLICY lodging_del ON public.lodging FOR DELETE TO authenticated USING (app_private.owns_trip(trip_id) OR criado_por = auth.uid());

ALTER TABLE public.reservation ENABLE ROW LEVEL SECURITY;
CREATE POLICY reservation_read ON public.reservation FOR SELECT TO authenticated USING (app_private.can_view_item_detail('reservation', id));
CREATE POLICY reservation_ins ON public.reservation FOR INSERT TO authenticated
  WITH CHECK (app_private.can_view_trip(trip_id) AND (criado_por = auth.uid() OR app_private.owns_trip(trip_id)));
CREATE POLICY reservation_upd ON public.reservation FOR UPDATE TO authenticated
  USING (app_private.owns_trip(trip_id) OR criado_por = auth.uid())
  WITH CHECK (app_private.can_view_trip(trip_id) AND (app_private.owns_trip(trip_id) OR criado_por = auth.uid()));
CREATE POLICY reservation_del ON public.reservation FOR DELETE TO authenticated USING (app_private.owns_trip(trip_id) OR criado_por = auth.uid());

ALTER TABLE public.ticket_passenger ENABLE ROW LEVEL SECURITY;
CREATE POLICY tp_read ON public.ticket_passenger FOR SELECT TO authenticated USING (app_private.can_view_item_detail('ticket', ticket_id));
CREATE POLICY tp_ins ON public.ticket_passenger FOR INSERT TO authenticated WITH CHECK (app_private.can_edit_item('ticket', ticket_id));
CREATE POLICY tp_upd ON public.ticket_passenger FOR UPDATE TO authenticated
  USING (app_private.can_edit_item('ticket', ticket_id)) WITH CHECK (app_private.can_edit_item('ticket', ticket_id));
CREATE POLICY tp_del ON public.ticket_passenger FOR DELETE TO authenticated USING (app_private.can_edit_item('ticket', ticket_id));

ALTER TABLE public.lodging_room ENABLE ROW LEVEL SECURITY;
CREATE POLICY lr_read ON public.lodging_room FOR SELECT TO authenticated USING (app_private.can_view_item_detail('lodging', lodging_id));
CREATE POLICY lr_ins ON public.lodging_room FOR INSERT TO authenticated WITH CHECK (app_private.can_edit_item('lodging', lodging_id));
CREATE POLICY lr_upd ON public.lodging_room FOR UPDATE TO authenticated
  USING (app_private.can_edit_item('lodging', lodging_id)) WITH CHECK (app_private.can_edit_item('lodging', lodging_id));
CREATE POLICY lr_del ON public.lodging_room FOR DELETE TO authenticated USING (app_private.can_edit_item('lodging', lodging_id));

ALTER TABLE public.lodging_guest ENABLE ROW LEVEL SECURITY;
CREATE POLICY lg_read ON public.lodging_guest FOR SELECT TO authenticated USING (app_private.can_view_item_detail('lodging', app_private.room_lodging(room_id)));
CREATE POLICY lg_ins ON public.lodging_guest FOR INSERT TO authenticated WITH CHECK (app_private.can_edit_item('lodging', app_private.room_lodging(room_id)));
CREATE POLICY lg_upd ON public.lodging_guest FOR UPDATE TO authenticated
  USING (app_private.can_edit_item('lodging', app_private.room_lodging(room_id))) WITH CHECK (app_private.can_edit_item('lodging', app_private.room_lodging(room_id)));
CREATE POLICY lg_del ON public.lodging_guest FOR DELETE TO authenticated USING (app_private.can_edit_item('lodging', app_private.room_lodging(room_id)));

ALTER TABLE public.reservation_person ENABLE ROW LEVEL SECURITY;
CREATE POLICY rp_read ON public.reservation_person FOR SELECT TO authenticated USING (app_private.can_view_item_detail('reservation', reservation_id));
CREATE POLICY rp_ins ON public.reservation_person FOR INSERT TO authenticated WITH CHECK (app_private.can_edit_item('reservation', reservation_id));
CREATE POLICY rp_upd ON public.reservation_person FOR UPDATE TO authenticated
  USING (app_private.can_edit_item('reservation', reservation_id)) WITH CHECK (app_private.can_edit_item('reservation', reservation_id));
CREATE POLICY rp_del ON public.reservation_person FOR DELETE TO authenticated USING (app_private.can_edit_item('reservation', reservation_id));

ALTER TABLE public.item_attachment ENABLE ROW LEVEL SECURITY;
CREATE POLICY ia_read ON public.item_attachment FOR SELECT TO authenticated USING (app_private.can_view_item_detail(item_tipo, item_id));
CREATE POLICY ia_ins ON public.item_attachment FOR INSERT TO authenticated WITH CHECK (app_private.can_edit_item(item_tipo, item_id));
CREATE POLICY ia_upd ON public.item_attachment FOR UPDATE TO authenticated
  USING (app_private.can_edit_item(item_tipo, item_id)) WITH CHECK (app_private.can_edit_item(item_tipo, item_id));
CREATE POLICY ia_del ON public.item_attachment FOR DELETE TO authenticated USING (app_private.can_edit_item(item_tipo, item_id));

DROP POLICY IF EXISTS trip_member_write ON public.trip_member;
CREATE POLICY trip_member_ins ON public.trip_member FOR INSERT TO authenticated WITH CHECK (app_private.owns_trip(trip_id));
CREATE POLICY trip_member_upd ON public.trip_member FOR UPDATE TO authenticated
  USING (app_private.owns_trip(trip_id) OR app_private.acct_person(person_id))
  WITH CHECK (app_private.owns_trip(trip_id) OR app_private.acct_person(person_id));
CREATE POLICY trip_member_del ON public.trip_member FOR DELETE TO authenticated USING (app_private.owns_trip(trip_id));
CREATE POLICY trip_member_self_read ON public.trip_member FOR SELECT TO authenticated USING (app_private.acct_person(person_id));

CREATE OR REPLACE FUNCTION app_private.trip_member_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR app_private.owns_trip(OLD.trip_id) THEN RETURN NEW; END IF;
  IF NEW.trip_id <> OLD.trip_id OR NEW.person_id <> OLD.person_id OR NEW.papel <> OLD.papel
     OR NEW.convidado_por IS DISTINCT FROM OLD.convidado_por OR NEW.entrou_em <> OLD.entrou_em
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     OR NEW.status NOT IN ('aceito','recusado','saiu') THEN
    RAISE EXCEPTION 'Só é possível responder ao convite';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trip_member_guard BEFORE UPDATE ON public.trip_member FOR EACH ROW EXECUTE FUNCTION app_private.trip_member_guard();

CREATE OR REPLACE FUNCTION app_private.trip_owner_member() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pid uuid;
BEGIN
  SELECT id INTO _pid FROM public.person WHERE account_id = NEW.owner_id AND kind = 'self' AND deleted_at IS NULL ORDER BY created_at LIMIT 1;
  IF _pid IS NOT NULL THEN
    INSERT INTO public.trip_member(trip_id, person_id, papel, status, convidado_por, respondido_em)
    VALUES (NEW.id, _pid, 'owner', 'aceito', NEW.owner_id, now());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trip_owner_member AFTER INSERT ON public.trip FOR EACH ROW EXECUTE FUNCTION app_private.trip_owner_member();

DROP POLICY IF EXISTS flight_status_read ON public.flight_status;
CREATE POLICY flight_status_read ON public.flight_status FOR SELECT TO authenticated
  USING (app_private.can_view_trip(app_private.ticket_trip(ticket_id)));

ALTER TABLE public.trip_trust ENABLE ROW LEVEL SECURITY;
CREATE POLICY trust_own ON public.trip_trust FOR ALL TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());
CREATE POLICY trust_organizer_read ON public.trip_trust FOR SELECT TO authenticated USING (organizer_id = auth.uid());

ALTER TABLE public.trip_notice ENABLE ROW LEVEL SECURITY;
CREATE POLICY notice_read ON public.trip_notice FOR SELECT TO authenticated
  USING (app_private.owns_trip(trip_id) OR (person_id IS NOT NULL AND app_private.acct_person(person_id)));
CREATE POLICY notice_ins ON public.trip_notice FOR INSERT TO authenticated
  WITH CHECK (app_private.owns_trip(trip_id) AND enviado_por = auth.uid());
CREATE POLICY notice_upd ON public.trip_notice FOR UPDATE TO authenticated
  USING (app_private.owns_trip(trip_id) OR (person_id IS NOT NULL AND app_private.acct_person(person_id)))
  WITH CHECK (app_private.owns_trip(trip_id) OR (person_id IS NOT NULL AND app_private.acct_person(person_id)));

CREATE OR REPLACE FUNCTION public.roteiro_viagem(_tid uuid)
RETURNS TABLE (
  item_tipo text, item_id uuid, subtipo text, titulo text,
  inicio_utc timestamptz, inicio_tz text, fim_utc timestamptz, fim_tz text,
  cidade text, origem_iata text, destino_iata text, companhia text, numero text,
  pessoas jsonb, detalhe boolean, editar boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT app_private.can_view_trip(_tid) THEN RETURN; END IF;
  RETURN QUERY
  SELECT 'ticket'::text, t.id, t.tipo, coalesce(t.origem_iata::text, t.origem_cidade, '?') || ' → ' || coalesce(t.destino_iata::text, t.destino_cidade, '?'),
    t.partida_utc, t.partida_tz, t.chegada_utc, t.chegada_tz, t.destino_cidade, t.origem_iata::text, t.destino_iata::text, t.companhia, t.numero,
    coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nome', coalesce(p.apelido, p.nome))) from public.ticket_passenger x join public.person p on p.id = x.person_id where x.ticket_id = t.id and x.deleted_at is null), '[]'::jsonb),
    app_private.can_view_item_detail('ticket', t.id), app_private.can_edit_item('ticket', t.id)
  FROM public.ticket t WHERE t.trip_id = _tid AND t.deleted_at IS NULL
  UNION ALL
  SELECT 'lodging'::text, l.id, 'hotel'::text, l.nome, l.checkin, 'UTC'::text, l.checkout, 'UTC'::text, l.cidade, null::text, null::text, null::text, null::text,
    coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nome', coalesce(p.apelido, p.nome))) from public.lodging_room r join public.lodging_guest g on g.room_id = r.id join public.person p on p.id = g.person_id where r.lodging_id = l.id and r.deleted_at is null and g.deleted_at is null), '[]'::jsonb),
    app_private.can_view_item_detail('lodging', l.id), app_private.can_edit_item('lodging', l.id)
  FROM public.lodging l WHERE l.trip_id = _tid AND l.deleted_at IS NULL
  UNION ALL
  SELECT 'reservation'::text, r.id, r.tipo, r.titulo, r.inicio_utc, r.inicio_tz, r.fim_utc, r.fim_tz, r.cidade, null::text, null::text, null::text, null::text,
    coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nome', coalesce(p.apelido, p.nome), 'papel', x.papel)) from public.reservation_person x join public.person p on p.id = x.person_id where x.reservation_id = r.id and x.deleted_at is null), '[]'::jsonb),
    app_private.can_view_item_detail('reservation', r.id), app_private.can_edit_item('reservation', r.id)
  FROM public.reservation r WHERE r.trip_id = _tid AND r.deleted_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.roteiro_viagem(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.roteiro_viagem(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.can_view_file(_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _pid uuid; _seg text; _tipo text; _item uuid;
BEGIN
  _seg := split_part(_name, '/', 1);
  IF _seg = 'trip' THEN
    SELECT item_tipo, item_id INTO _tipo, _item FROM public.item_attachment WHERE storage_path = _name AND deleted_at IS NULL LIMIT 1;
    IF _item IS NULL THEN RETURN false; END IF;
    RETURN app_private.can_view_item_detail(_tipo, _item);
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

CREATE OR REPLACE FUNCTION app_private.can_edit_trip_path(_name text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _item uuid;
BEGIN
  IF split_part(_name, '/', 1) <> 'trip' OR split_part(_name, '/', 3) !~ '^[0-9a-f-]{36}$' THEN RETURN false; END IF;
  _item := split_part(_name, '/', 3)::uuid;
  RETURN app_private.can_edit_item('ticket', _item) OR app_private.can_edit_item('lodging', _item) OR app_private.can_edit_item('reservation', _item);
END $$;
GRANT EXECUTE ON FUNCTION app_private.can_edit_trip_path(text) TO authenticated;

CREATE POLICY documentos_trip_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos' AND app_private.can_edit_trip_path(name));
CREATE POLICY documentos_trip_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos' AND app_private.can_edit_trip_path(name));
