-- Mesma lógica, mesmo nome, comando e papéis: só troca auth.uid() por (select auth.uid()), avaliado uma vez por consulta.
DO $$
DECLARE p record; _q text; _w text; _sql text;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname, qual, with_check FROM pg_policies
    WHERE schemaname = 'public' AND (qual ~ '(?<!SELECT )auth\.uid\(\)' OR with_check ~ '(?<!SELECT )auth\.uid\(\)')
  LOOP
    _q := regexp_replace(p.qual, '(?<!SELECT )auth\.uid\(\)', '(select auth.uid())', 'g');
    _w := regexp_replace(p.with_check, '(?<!SELECT )auth\.uid\(\)', '(select auth.uid())', 'g');
    _sql := format('ALTER POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    IF _q IS NOT NULL THEN _sql := _sql || format(' USING (%s)', _q); END IF;
    IF _w IS NOT NULL THEN _sql := _sql || format(' WITH CHECK (%s)', _w); END IF;
    EXECUTE _sql;
  END LOOP;
END $$;