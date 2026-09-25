INSERT INTO app_private.cron_config (k, v) VALUES ('status_voos', encode(extensions.gen_random_bytes(32), 'hex')) ON CONFLICT (k) DO NOTHING;
CREATE OR REPLACE FUNCTION public.verificar_cron_voos(_t text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM app_private.cron_config WHERE k = 'status_voos' AND v = _t);
$$;
REVOKE ALL ON FUNCTION public.verificar_cron_voos(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_cron_voos(text) TO service_role;