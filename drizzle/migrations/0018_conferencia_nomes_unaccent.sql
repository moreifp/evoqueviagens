CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.conferencia_nomes_voo(_ticket_id uuid)
 RETURNS TABLE(person_id uuid, estado text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _trip uuid;
BEGIN
  SELECT trip_id INTO _trip FROM public.ticket WHERE id = _ticket_id AND deleted_at IS NULL;
  IF _trip IS NULL OR NOT app_private.can_view_item_detail('ticket', _ticket_id) THEN RETURN; END IF;

  RETURN QUERY
  SELECT tp.person_id,
    CASE
      WHEN NOT (p.account_id = auth.uid() OR p.owner_id = auth.uid() OR app_private.can_view(p.id, 'documentos')) THEN 'sem_acesso'::text
      WHEN NOT EXISTS (SELECT 1 FROM public.traveler_document d WHERE d.person_id = p.id AND d.tipo = 'passaporte' AND d.deleted_at IS NULL) THEN 'sem_passaporte'::text
      WHEN p.nome_como_no_documento IS NOT NULL AND tp.nome_no_bilhete IS NOT NULL
        AND regexp_replace(upper(extensions.unaccent(p.nome_como_no_documento)), '[^A-Z ]', '', 'g') = regexp_replace(upper(extensions.unaccent(tp.nome_no_bilhete)), '[^A-Z ]', '', 'g') THEN 'confere'::text
      ELSE 'conferir'::text
    END
  FROM public.ticket_passenger tp
  JOIN public.person p ON p.id = tp.person_id
  WHERE tp.ticket_id = _ticket_id AND tp.deleted_at IS NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.conferencia_nomes_voo(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.conferencia_nomes_voo(uuid) TO authenticated;