-- Versiona o job que já existe no banco: status dos voos a cada 15 min.
-- Mesmo padrão do 'avisos-diarios' (0027): URL do app e token vêm de app_private.cron_config,
-- nenhum segredo neste arquivo. Idempotente: remove o job se existir e agenda de novo.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'status-voos-15min') THEN
    PERFORM cron.unschedule('status-voos-15min');
  END IF;
END
$$;

SELECT cron.schedule('status-voos-15min', '*/15 * * * *', $cmd$
  SELECT net.http_post(
    (SELECT v FROM app_private.cron_config WHERE k = 'app_url') || '/api/public/hooks/status-voos',
    '{}'::jsonb,
    '{}'::jsonb,
    jsonb_build_object('Authorization', 'Bearer ' || (SELECT v FROM app_private.cron_config WHERE k = 'status_voos'), 'Content-Type', 'application/json')
  );
$cmd$);
