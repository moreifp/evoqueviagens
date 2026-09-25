-- Parte 4: "Está tudo certo?", pedir dados, avisos.
CREATE TABLE public.entry_rule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nacionalidade char(2) NOT NULL,
  pais_destino char(2) NOT NULL,
  exigencia text NOT NULL,
  detalhe text,
  estadia_max_dias integer,
  validade_passaporte_min_meses integer,
  lead_time_dias integer,
  fonte_url text NOT NULL,
  verificado_em date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nacionalidade, pais_destino)
);
GRANT SELECT ON public.entry_rule TO authenticated;
GRANT ALL ON public.entry_rule TO service_role;
ALTER TABLE public.entry_rule ENABLE ROW LEVEL SECURITY;
CREATE POLICY entry_rule_read ON public.entry_rule FOR SELECT TO authenticated USING (true);

ALTER TABLE public.trip ADD COLUMN IF NOT EXISTS regra_passaporte jsonb;
COMMENT ON COLUMN public.trip.regra_passaporte IS 'Ajuste do organizador: {"meses":n,"base":"saida"|"chegada"}; nulo = regra geral';

ALTER TABLE public.trip_notice ADD COLUMN IF NOT EXISTS campo text;
ALTER TABLE public.share_invite ADD COLUMN IF NOT EXISTS para_account uuid;
ALTER TABLE public.share_invite ADD COLUMN IF NOT EXISTS grant_expira_em timestamptz;
ALTER TABLE public.share_invite ADD COLUMN IF NOT EXISTS recusado_em timestamptz;

-- Gatilho: documento atualizado resolve avisos. Nunca impede a gravação do documento.
CREATE OR REPLACE FUNCTION app_private.doc_resolve_aviso() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _campo text;
BEGIN
  BEGIN
    IF current_setting('app.teste_falha_aviso', true) = '1' THEN RAISE EXCEPTION 'falha simulada'; END IF;
    _campo := CASE WHEN NEW.tipo IN ('visto','esta','eta_canada','eta_uk','etias','k_eta','outro_visto') THEN 'visto'
                   WHEN NEW.tipo IN ('vacina','outra_vacina') THEN 'vacina' ELSE NEW.tipo END;
    UPDATE public.trip_notice SET resolvido_em = now()
      WHERE person_id = NEW.person_id AND campo = _campo AND resolvido_em IS NULL;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'doc_resolve_aviso: %', SQLERRM;
  END;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS doc_resolve_aviso ON public.traveler_document;
CREATE TRIGGER doc_resolve_aviso AFTER INSERT OR UPDATE ON public.traveler_document
  FOR EACH ROW WHEN (NEW.deleted_at IS NULL) EXECUTE FUNCTION app_private.doc_resolve_aviso();

-- Conferência por pessoa (só organizador). Dados de documento só com acesso.
CREATE OR REPLACE FUNCTION public.conferir_viagem(_tid uuid)
RETURNS TABLE(member_id uuid, person_id uuid, nome text, kind text, status text, papel text, acesso boolean, meu boolean,
  nacionalidades text[], nome_documento text, passaporte jsonb, vistos jsonb, vacina date, seguro date,
  nomes_bilhete text[], convite_telefone text, convite_email text, pedido_aberto boolean, avisos_abertos integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT app_private.owns_trip(_tid) THEN RETURN; END IF;
  RETURN QUERY
  SELECT m.id, p.id, coalesce(p.apelido, p.nome), p.kind, m.status, m.papel, x.ok, p.account_id = auth.uid(),
    CASE WHEN x.ok THEN p.nacionalidades ELSE '{}'::text[] END,
    CASE WHEN x.ok THEN p.nome_como_no_documento END,
    CASE WHEN x.ok THEN (SELECT jsonb_build_object('validade', d.validade, 'nome', d.nome_no_documento, 'pais', d.pais_emissor)
       FROM public.traveler_document d WHERE d.person_id = p.id AND d.tipo = 'passaporte' AND d.deleted_at IS NULL ORDER BY d.validade DESC NULLS LAST LIMIT 1) END,
    CASE WHEN x.ok THEN coalesce((SELECT jsonb_agg(jsonb_build_object('tipo', d.tipo, 'validade', d.validade)) FROM public.traveler_document d
       WHERE d.person_id = p.id AND d.deleted_at IS NULL AND d.tipo IN ('visto','esta','eta_canada','eta_uk','etias','k_eta','outro_visto')), '[]'::jsonb) ELSE '[]'::jsonb END,
    CASE WHEN x.ok THEN (SELECT max(d.validade) FROM public.traveler_document d WHERE d.person_id = p.id AND d.deleted_at IS NULL AND d.tipo IN ('vacina','outra_vacina')) END,
    CASE WHEN x.ok THEN (SELECT max(d.validade) FROM public.traveler_document d WHERE d.person_id = p.id AND d.deleted_at IS NULL AND d.tipo = 'seguro') END,
    coalesce((SELECT array_agg(DISTINCT tp.nome_no_bilhete) FROM public.ticket_passenger tp JOIN public.ticket k ON k.id = tp.ticket_id
       WHERE tp.person_id = p.id AND tp.deleted_at IS NULL AND k.trip_id = _tid AND k.deleted_at IS NULL AND tp.nome_no_bilhete IS NOT NULL), '{}'),
    m.convite_telefone, m.convite_email,
    EXISTS (SELECT 1 FROM public.share_invite i WHERE i.from_id = auth.uid() AND i.trip_id = _tid AND i.person_id = p.id AND i.usado_em IS NULL AND i.recusado_em IS NULL AND i.expira_em > now()),
    (SELECT count(*)::int FROM public.trip_notice n WHERE n.trip_id = _tid AND n.person_id = p.id AND n.resolvido_em IS NULL AND n.tipo = 'aviso')
  FROM public.trip_member m JOIN public.person p ON p.id = m.person_id
  CROSS JOIN LATERAL (SELECT (p.account_id = auth.uid() OR app_private.can_view(p.id, 'documentos')) AS ok) x
  WHERE m.trip_id = _tid AND m.deleted_at IS NULL AND p.deleted_at IS NULL
  ORDER BY m.created_at;
END $$;
REVOKE ALL ON FUNCTION public.conferir_viagem(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conferir_viagem(uuid) TO authenticated;

-- Pedir dados no app (entra pela fila offline).
CREATE OR REPLACE FUNCTION public.pedir_dados(_id uuid, _trip uuid, _person uuid, _blocos text[], _ate_fim boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; t record; _nome text;
BEGIN
  IF auth.uid() IS NULL OR NOT app_private.owns_trip(_trip) THEN RAISE EXCEPTION 'Só quem organiza pode pedir'; END IF;
  IF EXISTS (SELECT 1 FROM public.share_invite WHERE id = _id) THEN RETURN _id; END IF;
  SELECT * INTO p FROM public.person WHERE id = _person AND deleted_at IS NULL;
  IF p.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.trip_member WHERE trip_id = _trip AND person_id = _person AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Pessoa fora da viagem'; END IF;
  IF p.kind = 'precadastro' OR p.account_id = auth.uid() THEN RAISE EXCEPTION 'Pessoa sem conta própria'; END IF;
  SELECT * INTO t FROM public.trip WHERE id = _trip;
  SELECT coalesce(apelido, nome) INTO _nome FROM public.person WHERE account_id = auth.uid() AND kind = 'self' AND deleted_at IS NULL ORDER BY created_at LIMIT 1;
  INSERT INTO public.share_invite(id, from_id, from_nome, direcao, blocos, person_id, token_hash, expira_em, trip_id, para_account, grant_expira_em)
  VALUES (_id, auth.uid(), coalesce(_nome, 'Organizador'), 'pedido',
    CASE WHEN p.kind = 'dependent' AND NOT 'dependentes' = ANY(_blocos) THEN _blocos || 'dependentes'::text ELSE _blocos END,
    _person, encode(extensions.gen_random_bytes(32), 'hex'), greatest(now() + interval '30 days', (t.data_fim + 1)::timestamptz), _trip, p.account_id,
    CASE WHEN _ate_fim THEN (t.data_fim + 1)::timestamptz END);
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.pedir_dados(uuid, uuid, uuid, text[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pedir_dados(uuid, uuid, uuid, text[], boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.pedidos_recebidos()
RETURNS TABLE(id uuid, from_id uuid, from_nome text, blocos text[], trip_id uuid, viagem text, ate timestamptz, pessoa text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.from_id, i.from_nome, i.blocos, i.trip_id, t.nome, i.grant_expira_em, coalesce(p.apelido, p.nome)
  FROM public.share_invite i LEFT JOIN public.trip t ON t.id = i.trip_id LEFT JOIN public.person p ON p.id = i.person_id
  WHERE i.para_account = auth.uid() AND i.direcao = 'pedido' AND i.usado_em IS NULL AND i.recusado_em IS NULL AND i.expira_em > now()
  ORDER BY i.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.pedidos_recebidos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pedidos_recebidos() TO authenticated;

CREATE OR REPLACE FUNCTION public.responder_pedido(_id uuid, _blocos text[], _aceitar boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i record; _nome text; _trips uuid[];
BEGIN
  SELECT * INTO i FROM public.share_invite WHERE id = _id AND para_account = auth.uid() AND direcao = 'pedido';
  IF i.id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF i.usado_em IS NOT NULL OR i.recusado_em IS NOT NULL THEN RETURN true; END IF;
  IF NOT _aceitar OR coalesce(array_length(_blocos, 1), 0) = 0 THEN
    UPDATE public.share_invite SET recusado_em = now() WHERE id = _id; RETURN true;
  END IF;
  SELECT coalesce(apelido, nome) INTO _nome FROM public.person WHERE account_id = auth.uid() AND kind = 'self' AND deleted_at IS NULL ORDER BY created_at LIMIT 1;
  IF 'viagens' = ANY(_blocos) THEN
    SELECT coalesce(array_agg(id), '{}') INTO _trips FROM public.trip WHERE owner_id = auth.uid() AND id = i.trip_id;
  END IF;
  UPDATE public.share_grant SET status = 'revogado', revogado_em = now() WHERE owner_id = auth.uid() AND grantee_id = i.from_id AND status = 'ativo';
  INSERT INTO public.share_grant(owner_id, grantee_id, owner_nome, grantee_nome, blocos, trip_ids, trip_id, expira_em)
  VALUES (auth.uid(), i.from_id, coalesce(_nome, 'Participante'), i.from_nome, _blocos, _trips, i.trip_id, i.grant_expira_em);
  UPDATE public.share_invite SET usado_em = now(), usado_por = auth.uid() WHERE id = _id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.responder_pedido(uuid, text[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.responder_pedido(uuid, text[], boolean) TO authenticated;

-- Avisos: organizador envia tipo 'aviso'; participante/responsável marca "Já resolvi" (policy notice_upd já cobre).
CREATE INDEX IF NOT EXISTS trip_notice_person_aberto ON public.trip_notice(person_id) WHERE resolvido_em IS NULL;