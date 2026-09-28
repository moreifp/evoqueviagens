ALTER TABLE public.despesas_link ADD COLUMN IF NOT EXISTS expira_em timestamptz;
UPDATE public.despesas_link l SET expira_em = (t.data_fim + 31)::timestamptz FROM public.trip t WHERE t.id = l.trip_id AND l.expira_em IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS despesas_link_um_ativo ON public.despesas_link (trip_id) WHERE revogado_em IS NULL;

ALTER TABLE public.expense ADD COLUMN IF NOT EXISTS recibo_texto text;
ALTER TABLE public.expense ADD COLUMN IF NOT EXISTS recibo_path text;

-- Organizador grava o WhatsApp de um participante da própria viagem. Devolve quantas linhas mudou.
CREATE OR REPLACE FUNCTION public.salvar_whatsapp_participante(_trip uuid, _person uuid, _telefone text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n integer := 0; m integer := 0; p record;
BEGIN
  IF auth.uid() IS NULL OR NOT app_private.owns_trip(_trip) THEN RAISE EXCEPTION 'Só quem organiza esta viagem pode salvar o WhatsApp.'; END IF;
  IF coalesce(trim(_telefone), '') !~ '^\+[0-9]{7,16}$' THEN RAISE EXCEPTION 'Número inválido.'; END IF;
  SELECT * INTO p FROM public.person WHERE id = _person AND deleted_at IS NULL;
  IF p.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.trip_member WHERE trip_id = _trip AND person_id = _person AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Esta pessoa não está na viagem.';
  END IF;
  IF p.account_id = auth.uid() THEN
    UPDATE public.person SET telefone = trim(_telefone), atualizado_em = now() WHERE id = _person;
    GET DIAGNOSTICS n = ROW_COUNT;
  END IF;
  UPDATE public.trip_member SET convite_telefone = trim(_telefone) WHERE trip_id = _trip AND person_id = _person AND deleted_at IS NULL;
  GET DIAGNOSTICS m = ROW_COUNT;
  RETURN n + m;
END $$;
REVOKE ALL ON FUNCTION public.salvar_whatsapp_participante(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_whatsapp_participante(uuid, uuid, text) TO authenticated;