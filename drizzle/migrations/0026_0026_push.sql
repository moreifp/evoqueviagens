-- Avisos no celular (push) — tabelas aditivas, sem tocar no cadastro pessoal.

CREATE TABLE public.push_device (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  plataforma text NOT NULL DEFAULT 'web',
  user_agent text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  visto_em timestamptz NOT NULL DEFAULT now(),
  ativo boolean NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_device TO authenticated;
GRANT ALL ON public.push_device TO service_role;
ALTER TABLE public.push_device ENABLE ROW LEVEL SECURITY;
CREATE POLICY push_device_dono ON public.push_device FOR ALL TO authenticated
  USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

CREATE TABLE public.push_pref (
  account_id uuid PRIMARY KEY,
  voo boolean NOT NULL DEFAULT true,
  aviso boolean NOT NULL DEFAULT true,
  convite boolean NOT NULL DEFAULT true,
  claude boolean NOT NULL DEFAULT true,
  documento boolean NOT NULL DEFAULT true,
  checkin boolean NOT NULL DEFAULT false,
  silencio_inicio text NOT NULL DEFAULT '22:00',
  silencio_fim text NOT NULL DEFAULT '07:00',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_pref TO authenticated;
GRANT ALL ON public.push_pref TO service_role;
ALTER TABLE public.push_pref ENABLE ROW LEVEL SECURITY;
CREATE POLICY push_pref_dono ON public.push_pref FOR ALL TO authenticated
  USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

CREATE TABLE public.push_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  tipo text NOT NULL,
  ref_id text,
  titulo text NOT NULL,
  corpo text NOT NULL,
  url text,
  status text NOT NULL,
  erro text,
  enviado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.push_log TO authenticated;
GRANT ALL ON public.push_log TO service_role;
ALTER TABLE public.push_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY push_log_leitura_dono ON public.push_log FOR SELECT TO authenticated
  USING (account_id = auth.uid());
CREATE INDEX push_log_dedupe ON public.push_log (account_id, tipo, ref_id, enviado_em);