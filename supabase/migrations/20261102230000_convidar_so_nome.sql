-- Participante só desta viagem: pode entrar só com o nome, sem e-mail nem WhatsApp.
-- Sem contato não há convite a aceitar, então já entra como aceito. A pessoa fica
-- como 'precadastro' (dona: a conta que organiza), fora da aba de dependentes,
-- e o organizador pode guardar os documentos dela como de qualquer pessoa sua.
CREATE OR REPLACE FUNCTION public.convidar_sem_conta(_trip uuid, _member uuid, _person uuid, _nome text, _email text, _telefone text, _idioma text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sem_contato boolean := coalesce(trim(_email), '') = '' AND coalesce(trim(_telefone), '') = '';
BEGIN
  IF auth.uid() IS NULL OR NOT app_private.owns_trip(_trip) THEN RAISE EXCEPTION 'Só quem organiza pode convidar'; END IF;
  IF coalesce(trim(_nome), '') = '' THEN RAISE EXCEPTION 'Informe o nome'; END IF;
  IF EXISTS (SELECT 1 FROM public.trip_member WHERE id = _member) THEN RETURN _member; END IF;
  INSERT INTO public.person(id, nome, account_id, owner_id, kind, email, telefone, idioma)
  VALUES (_person, trim(_nome), auth.uid(), auth.uid(), 'precadastro', nullif(lower(trim(_email)), ''), nullif(trim(_telefone), ''), CASE WHEN _idioma = 'en' THEN 'en' ELSE 'pt' END);
  INSERT INTO public.trip_member(id, trip_id, person_id, papel, status, convidado_por, convite_email, convite_telefone, convite_idioma)
  VALUES (_member, _trip, _person, 'membro', CASE WHEN _sem_contato THEN 'aceito' ELSE 'convidado' END, auth.uid(), nullif(lower(trim(_email)), ''), nullif(trim(_telefone), ''), CASE WHEN _idioma = 'en' THEN 'en' ELSE 'pt' END);
  RETURN _member;
END $$;
REVOKE ALL ON FUNCTION public.convidar_sem_conta(uuid, uuid, uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convidar_sem_conta(uuid, uuid, uuid, text, text, text, text) TO authenticated;
