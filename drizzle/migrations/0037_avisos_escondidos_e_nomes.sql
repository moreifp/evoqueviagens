CREATE TABLE IF NOT EXISTS public.aviso_escondido (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL DEFAULT auth.uid(),
  chave text NOT NULL,
  impressao text NOT NULL,
  rotulo text NOT NULL DEFAULT '',
  contexto text,
  escondido_em timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (account_id, chave)
);
GRANT SELECT, INSERT, UPDATE ON public.aviso_escondido TO authenticated;
GRANT ALL ON public.aviso_escondido TO service_role;
ALTER TABLE public.aviso_escondido ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aviso_escondido_select" ON public.aviso_escondido FOR SELECT TO authenticated USING (account_id = auth.uid());
CREATE POLICY "aviso_escondido_insert" ON public.aviso_escondido FOR INSERT TO authenticated WITH CHECK (account_id = auth.uid());
CREATE POLICY "aviso_escondido_update" ON public.aviso_escondido FOR UPDATE TO authenticated USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

CREATE OR REPLACE FUNCTION public.tokens_nome(_s text)
RETURNS text[] LANGUAGE plpgsql STABLE SET search_path TO 'public', 'extensions' AS $$
DECLARE s text; arr text[]; res text[] := '{}'; t text; i int := 0;
BEGIN
  IF _s IS NULL THEN RETURN '{}'; END IF;
  s := upper(extensions.unaccent(_s));
  IF position('/' in s) > 0 THEN s := split_part(s, '/', 2) || ' ' || split_part(s, '/', 1); END IF;
  s := regexp_replace(s, '[''`´’]', '', 'g');
  s := regexp_replace(s, '[^A-Z ]', ' ', 'g');
  arr := regexp_split_to_array(trim(s), '\s+');
  FOREACH t IN ARRAY arr LOOP
    IF t = '' OR t IN ('DE','DA','DO','DOS','DAS','E') THEN CONTINUE; END IF;
    i := i + 1;
    IF i > 1 AND t IN ('MR','MRS','MS','MISS','MSTR','CHD','INF') THEN CONTINUE; END IF;
    res := res || t;
  END LOOP;
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.nivel_nome(_doc text, _bil text)
RETURNS text LANGUAGE plpgsql STABLE SET search_path TO 'public', 'extensions' AS $$
DECLARE d text[] := public.tokens_nome(_doc); b text[] := public.tokens_nome(_bil); x text; j int := 1; nd int; nb int;
BEGIN
  nd := coalesce(array_length(d, 1), 0); nb := coalesce(array_length(b, 1), 0);
  IF nd = 0 OR nb = 0 THEN RETURN 'conferir'; END IF;
  IF b[1] <> d[1] THEN
    IF d[1] = ANY(b) AND EXISTS (SELECT 1 FROM unnest(b) y WHERE y = ANY(d[2:nd])) THEN RETURN 'conferir'; END IF;
    RETURN 'resolver';
  END IF;
  IF b[nb] <> d[nd] THEN RETURN 'conferir'; END IF;
  FOREACH x IN ARRAY b LOOP
    WHILE j <= nd AND NOT (d[j] = x OR (length(x) = 1 AND left(d[j], 1) = x)) LOOP j := j + 1; END LOOP;
    IF j > nd THEN RETURN 'conferir'; END IF;
    j := j + 1;
  END LOOP;
  RETURN 'ok';
END $$;

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
      WHEN p.nome_como_no_documento IS NOT NULL AND tp.nome_no_bilhete IS NOT NULL AND public.nivel_nome(p.nome_como_no_documento, tp.nome_no_bilhete) = 'ok' THEN 'confere'::text
      WHEN p.nome_como_no_documento IS NOT NULL AND tp.nome_no_bilhete IS NOT NULL AND public.nivel_nome(p.nome_como_no_documento, tp.nome_no_bilhete) = 'resolver' THEN 'diferente'::text
      ELSE 'conferir'::text
    END
  FROM public.ticket_passenger tp
  JOIN public.person p ON p.id = tp.person_id
  WHERE tp.ticket_id = _ticket_id AND tp.deleted_at IS NULL;
END;
$function$;