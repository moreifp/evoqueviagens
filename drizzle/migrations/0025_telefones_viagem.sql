CREATE OR REPLACE FUNCTION public.telefones_viagem(_tid uuid)
 RETURNS TABLE(person_id uuid, telefone text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT app_private.owns_trip(_tid) THEN RETURN; END IF;
  RETURN QUERY
  SELECT p.id, p.telefone FROM public.trip_member m JOIN public.person p ON p.id = m.person_id
  WHERE m.trip_id = _tid AND m.deleted_at IS NULL AND p.deleted_at IS NULL AND p.telefone IS NOT NULL
    AND p.kind <> 'precadastro'
    AND (p.account_id = auth.uid() OR p.owner_id = auth.uid() OR app_private.can_view(p.id, 'basico'));
END $$;
REVOKE ALL ON FUNCTION public.telefones_viagem(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.telefones_viagem(uuid) TO authenticated;