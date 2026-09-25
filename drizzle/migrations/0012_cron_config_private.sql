CREATE TABLE IF NOT EXISTS app_private.cron_config (k text PRIMARY KEY, v text NOT NULL);
REVOKE ALL ON app_private.cron_config FROM PUBLIC, anon, authenticated;