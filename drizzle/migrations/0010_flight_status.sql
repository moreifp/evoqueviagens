CREATE TABLE public.flight_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.ticket(id) ON DELETE CASCADE,
  consultado_em timestamptz NOT NULL DEFAULT now(),
  status text,
  partida_prevista_utc timestamptz, partida_revista_utc timestamptz, partida_real_utc timestamptz,
  chegada_prevista_utc timestamptz, chegada_revista_utc timestamptz, chegada_real_utc timestamptz,
  terminal_partida text, portao_partida text, terminal_chegada text, portao_chegada text, esteira text,
  atraso_partida_min integer, atraso_chegada_min integer,
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('auto','manual')),
  payload_json jsonb
);
GRANT SELECT ON public.flight_status TO authenticated;
GRANT ALL ON public.flight_status TO service_role;
ALTER TABLE public.flight_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY flight_status_read ON public.flight_status FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ticket t WHERE t.id = flight_status.ticket_id AND app_private.can_view_trip(t.trip_id)));
CREATE INDEX flight_status_ticket_idx ON public.flight_status(ticket_id, consultado_em DESC);

CREATE TABLE public.api_usage (
  mes text PRIMARY KEY,
  unidades integer NOT NULL DEFAULT 0,
  aviso_em timestamptz
);
GRANT ALL ON public.api_usage TO service_role;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.api_alerta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trip(id) ON DELETE CASCADE,
  mensagem text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.api_alerta TO authenticated;
GRANT ALL ON public.api_alerta TO service_role;
ALTER TABLE public.api_alerta ENABLE ROW LEVEL SECURITY;
CREATE POLICY api_alerta_owner ON public.api_alerta FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trip t WHERE t.id = api_alerta.trip_id AND t.owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.somar_uso_api(_mes text, _n integer) RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.api_usage(mes, unidades) VALUES (_mes, _n)
  ON CONFLICT (mes) DO UPDATE SET unidades = public.api_usage.unidades + EXCLUDED.unidades
  RETURNING unidades;
$$;
REVOKE ALL ON FUNCTION public.somar_uso_api(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.somar_uso_api(text, integer) TO service_role;