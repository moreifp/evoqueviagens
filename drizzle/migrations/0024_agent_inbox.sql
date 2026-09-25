CREATE TABLE public.agent_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL DEFAULT auth.uid(),
  trip_id uuid REFERENCES public.trip(id),
  tipo_alvo text NOT NULL CHECK (tipo_alvo IN ('voo','hotel','reserva','despesa')),
  payload_json jsonb NOT NULL,
  idempotency_key text NOT NULL,
  origem_cliente text,
  lote_id uuid,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','confirmado','descartado')),
  achados_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz,
  item_id uuid,
  UNIQUE (account_id, idempotency_key)
);
COMMENT ON TABLE public.agent_inbox IS 'Itens propostos por um agente (Claude via MCP). Nascem pendentes; só viram item quando o dono confirma pela tela.';
CREATE INDEX agent_inbox_pendentes ON public.agent_inbox (account_id, trip_id) WHERE status = 'pendente';

GRANT SELECT, INSERT, UPDATE ON public.agent_inbox TO authenticated;
GRANT ALL ON public.agent_inbox TO service_role;
ALTER TABLE public.agent_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_inbox_read ON public.agent_inbox FOR SELECT TO authenticated
  USING (account_id = auth.uid());
CREATE POLICY agent_inbox_ins ON public.agent_inbox FOR INSERT TO authenticated
  WITH CHECK (account_id = auth.uid() AND status = 'pendente'
    AND (trip_id IS NULL OR app_private.can_view_trip(trip_id)));
CREATE POLICY agent_inbox_upd ON public.agent_inbox FOR UPDATE TO authenticated
  USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

-- Depois de criado, só dá para: escolher a viagem enquanto pendente, e resolver (pendente → confirmado/descartado) uma única vez.
CREATE OR REPLACE FUNCTION app_private.agent_inbox_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.account_id <> OLD.account_id OR NEW.tipo_alvo <> OLD.tipo_alvo OR NEW.payload_json <> OLD.payload_json
     OR NEW.idempotency_key <> OLD.idempotency_key OR NEW.criado_em <> OLD.criado_em
     OR NEW.lote_id IS DISTINCT FROM OLD.lote_id OR NEW.origem_cliente IS DISTINCT FROM OLD.origem_cliente THEN
    RAISE EXCEPTION 'agent_inbox: conteúdo não pode mudar';
  END IF;
  IF OLD.status <> 'pendente' THEN
    RAISE EXCEPTION 'agent_inbox: item já resolvido';
  END IF;
  IF NEW.trip_id IS DISTINCT FROM OLD.trip_id AND NEW.trip_id IS NOT NULL AND NOT app_private.can_view_trip(NEW.trip_id) THEN
    RAISE EXCEPTION 'agent_inbox: viagem sem acesso';
  END IF;
  IF NEW.status <> 'pendente' AND NEW.resolvido_em IS NULL THEN NEW.resolvido_em := now(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER agent_inbox_guard BEFORE UPDATE ON public.agent_inbox FOR EACH ROW EXECUTE FUNCTION app_private.agent_inbox_guard();