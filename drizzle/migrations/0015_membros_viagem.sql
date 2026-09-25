-- Nomes de quem está na viagem, para todos os membros (sem documentos nem contato).
CREATE OR REPLACE FUNCTION public.membros_viagem(_tid uuid)
RETURNS TABLE (id uuid, person_id uuid, papel text, status text, nome text, apelido text, nome_como_no_documento text, kind text, meu boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT app_private.can_view_trip(_tid) THEN RETURN; END IF;
  RETURN QUERY
  SELECT m.id, m.person_id, m.papel, m.status, p.nome, p.apelido, p.nome_como_no_documento, p.kind, (p.account_id = auth.uid())
  FROM public.trip_member m JOIN public.person p ON p.id = m.person_id
  WHERE m.trip_id = _tid AND m.deleted_at IS NULL
  ORDER BY (m.papel = 'owner') DESC, m.created_at;
END $$;
REVOKE ALL ON FUNCTION public.membros_viagem(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.membros_viagem(uuid) TO authenticated;
