-- Gatilhos de aviso push: banco chama /api/public/hooks/push-evento via pg_net.
-- Tolerante a falha: aviso nunca impede a gravação original.

INSERT INTO app_private.cron_config (k, v) VALUES ('app_url', 'https://app.evoque.global') ON CONFLICT (k) DO NOTHING;

CREATE OR REPLACE FUNCTION app_private.push_evento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private', 'extensions'
AS $function$
DECLARE _url text; _tok text; _corpo jsonb;
BEGIN
  SELECT v INTO _url FROM app_private.cron_config WHERE k = 'app_url';
  SELECT v INTO _tok FROM app_private.cron_config WHERE k = 'status_voos';
  IF _url IS NULL OR _tok IS NULL THEN RETURN NEW; END IF;
  _corpo := CASE TG_TABLE_NAME
    WHEN 'trip_notice' THEN jsonb_build_object('tipo', 'aviso', 'id', NEW.id)
    WHEN 'agent_inbox' THEN jsonb_build_object('tipo', 'claude', 'account_id', NEW.account_id)
    WHEN 'trip_member' THEN jsonb_build_object('tipo', 'convite', 'id', NEW.id)
  END;
  PERFORM net.http_post(
    _url || '/api/public/hooks/push-evento',
    _corpo,
    '{}'::jsonb,
    jsonb_build_object('Authorization', 'Bearer ' || _tok, 'Content-Type', 'application/json')
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END
$function$;

CREATE TRIGGER push_aviso_organizador
  AFTER INSERT ON public.trip_notice
  FOR EACH ROW WHEN (NEW.tipo = 'aviso' AND NEW.person_id IS NOT NULL)
  EXECUTE FUNCTION app_private.push_evento();

CREATE TRIGGER push_caixa_claude
  AFTER INSERT ON public.agent_inbox
  FOR EACH ROW WHEN (NEW.status = 'pendente')
  EXECUTE FUNCTION app_private.push_evento();

CREATE TRIGGER push_convite_viagem
  AFTER INSERT ON public.trip_member
  FOR EACH ROW WHEN (NEW.status = 'convidado')
  EXECUTE FUNCTION app_private.push_evento();

-- Job diário (11h UTC = 8h em São Paulo): documentos vencendo e lembretes de check-in.
SELECT cron.schedule('avisos-diarios', '0 11 * * *', $cmd$
  SELECT net.http_post(
    (SELECT v FROM app_private.cron_config WHERE k = 'app_url') || '/api/public/hooks/avisos-diarios',
    '{}'::jsonb,
    '{}'::jsonb,
    jsonb_build_object('Authorization', 'Bearer ' || (SELECT v FROM app_private.cron_config WHERE k = 'status_voos'), 'Content-Type', 'application/json')
  );
$cmd$);