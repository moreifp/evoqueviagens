CREATE OR REPLACE FUNCTION public.nivel_nome(_doc text, _bil text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  d text[] := public.tokens_nome(_doc); b text[] := public.tokens_nome(_bil); x text; j int := 1; nd int; nb int;
  sufixos text[] := ARRAY['FILHO','FILHA','NETO','NETA','SOBRINHO','SOBRINHA','JUNIOR','JR','SEGUNDO','TERCEIRO','II','III','IV'];
  sd text; sb text;
BEGIN
  nd := coalesce(array_length(d, 1), 0); nb := coalesce(array_length(b, 1), 0);
  -- Sufixo de geracao nao conta como sobrenome: remover do fim dos dois lados.
  IF nd > 1 AND d[nd] = ANY(sufixos) THEN sd := d[nd]; d := d[1:nd-1]; nd := nd - 1; END IF;
  IF nb > 1 AND b[nb] = ANY(sufixos) THEN sb := b[nb]; b := b[1:nb-1]; nb := nb - 1; END IF;
  IF nd = 0 OR nb = 0 THEN RETURN 'conferir'; END IF;
  -- Sufixos diferentes dos dois lados (FILHO x NETO) -> ambar.
  IF sd IS NOT NULL AND sb IS NOT NULL AND sd <> sb THEN RETURN 'conferir'; END IF;
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
END $function$;