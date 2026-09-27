CREATE OR REPLACE FUNCTION public.adicionar_pessoa_so_nome(_trip uuid, _member uuid, _person uuid, _nome text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ini date;
BEGIN
  IF auth.uid() IS NULL OR NOT app_private.owns_trip(_trip) THEN RAISE EXCEPTION 'Só quem organiza pode adicionar pessoas'; END IF;
  IF coalesce(trim(_nome), '') = '' THEN RAISE EXCEPTION 'Informe o nome'; END IF;
  IF EXISTS (SELECT 1 FROM public.trip_member WHERE id = _member) THEN RETURN _member; END IF;
  SELECT data_inicio INTO _ini FROM public.trip WHERE id = _trip;
  INSERT INTO public.person(id, nome, apelido, account_id, owner_id, kind, idioma)
  VALUES (_person, trim(_nome), split_part(trim(_nome), ' ', 1), auth.uid(), auth.uid(), 'precadastro', 'pt');
  INSERT INTO public.trip_member(id, trip_id, person_id, papel, status, convidado_por, convite_idioma, entrou_em)
  VALUES (_member, _trip, _person, 'membro', 'aceito', auth.uid(), 'pt', least(coalesce(_ini, current_date), current_date));
  RETURN _member;
END $$;
REVOKE ALL ON FUNCTION public.adicionar_pessoa_so_nome(uuid, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adicionar_pessoa_so_nome(uuid, uuid, uuid, text) TO authenticated;