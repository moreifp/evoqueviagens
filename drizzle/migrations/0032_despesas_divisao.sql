ALTER TABLE public.expense
  ADD COLUMN IF NOT EXISTS pessoal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pessoal_de uuid REFERENCES public.person(id),
  ADD COLUMN IF NOT EXISTS divisao text NOT NULL DEFAULT 'igual',
  ADD COLUMN IF NOT EXISTS taxa_provisoria boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS item_tipo text,
  ADD COLUMN IF NOT EXISTS item_id uuid;
ALTER TABLE public.expense ADD CONSTRAINT expense_divisao_check CHECK (divisao IN ('igual','valor','pct','cotas'));
ALTER TABLE public.expense ADD CONSTRAINT expense_categoria_check CHECK (categoria IN ('comida','transporte','hospedagem','passeio','compras','outros'));
ALTER TABLE public.expense ADD CONSTRAINT expense_pessoal_check CHECK (NOT pessoal OR pessoal_de IS NOT NULL);
ALTER TABLE public.expense ADD CONSTRAINT expense_item_tipo_check CHECK (item_tipo IS NULL OR item_tipo IN ('ticket','lodging','reservation'));

CREATE TABLE public.expense_payer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expense(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.person(id),
  valor_original numeric NOT NULL,
  valor_moeda_base numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX expense_payer_expense_idx ON public.expense_payer(expense_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_payer TO authenticated;
GRANT ALL ON public.expense_payer TO service_role;
ALTER TABLE public.expense_payer ENABLE ROW LEVEL SECURITY;
CREATE POLICY expense_payer_read ON public.expense_payer FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.expense e WHERE e.id = expense_id AND app_private.can_view_trip(e.trip_id)));
CREATE POLICY expense_payer_write ON public.expense_payer FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.expense e WHERE e.id = expense_id AND app_private.owns_trip(e.trip_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.expense e WHERE e.id = expense_id AND app_private.owns_trip(e.trip_id)));

CREATE TABLE public.expense_share (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expense(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.person(id),
  peso numeric NOT NULL DEFAULT 1,
  valor_moeda_base numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX expense_share_expense_idx ON public.expense_share(expense_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_share TO authenticated;
GRANT ALL ON public.expense_share TO service_role;
ALTER TABLE public.expense_share ENABLE ROW LEVEL SECURITY;
CREATE POLICY expense_share_read ON public.expense_share FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.expense e WHERE e.id = expense_id AND app_private.can_view_trip(e.trip_id)));
CREATE POLICY expense_share_write ON public.expense_share FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.expense e WHERE e.id = expense_id AND app_private.owns_trip(e.trip_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.expense e WHERE e.id = expense_id AND app_private.owns_trip(e.trip_id)));

CREATE TABLE public.settlement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trip(id) ON DELETE CASCADE,
  de_person_id uuid NOT NULL REFERENCES public.person(id),
  para_person_id uuid NOT NULL REFERENCES public.person(id),
  valor_moeda_base numeric NOT NULL CHECK (valor_moeda_base > 0),
  data date NOT NULL DEFAULT current_date,
  nota text,
  registrado_por uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX settlement_trip_idx ON public.settlement(trip_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlement TO authenticated;
GRANT ALL ON public.settlement TO service_role;
ALTER TABLE public.settlement ENABLE ROW LEVEL SECURITY;
CREATE POLICY settlement_read ON public.settlement FOR SELECT TO authenticated USING (app_private.can_view_trip(trip_id));
CREATE POLICY settlement_write ON public.settlement FOR ALL TO authenticated USING (app_private.owns_trip(trip_id)) WITH CHECK (app_private.owns_trip(trip_id));

CREATE TABLE public.expense_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid REFERENCES public.expense(id) ON DELETE CASCADE,
  settlement_id uuid REFERENCES public.settlement(id) ON DELETE CASCADE,
  acao text NOT NULL CHECK (acao IN ('criou','editou','apagou','desfez')),
  antes jsonb,
  depois jsonb,
  por uuid,
  em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expense_log_expense_idx ON public.expense_log(expense_id);
GRANT SELECT ON public.expense_log TO authenticated;
GRANT ALL ON public.expense_log TO service_role;
ALTER TABLE public.expense_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY expense_log_read ON public.expense_log FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.expense e WHERE e.id = expense_id AND app_private.can_view_trip(e.trip_id))
  OR EXISTS (SELECT 1 FROM public.settlement s WHERE s.id = settlement_id AND app_private.can_view_trip(s.trip_id)));

CREATE OR REPLACE FUNCTION app_private.log_despesa() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a text;
BEGIN
  IF TG_OP = 'INSERT' THEN a := 'criou';
  ELSIF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN a := 'apagou';
  ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN a := 'desfez';
  ELSE a := 'editou';
  END IF;
  IF TG_TABLE_NAME = 'expense' THEN
    INSERT INTO public.expense_log(expense_id, acao, antes, depois, por)
    VALUES (NEW.id, a, CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) - 'comprovante_url' END, to_jsonb(NEW) - 'comprovante_url', auth.uid());
  ELSE
    INSERT INTO public.expense_log(settlement_id, acao, antes, depois, por)
    VALUES (NEW.id, a, CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) END, to_jsonb(NEW), auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expense_log_trg AFTER INSERT OR UPDATE ON public.expense FOR EACH ROW EXECUTE FUNCTION app_private.log_despesa();
CREATE TRIGGER settlement_log_trg AFTER INSERT OR UPDATE ON public.settlement FOR EACH ROW EXECUTE FUNCTION app_private.log_despesa();

CREATE OR REPLACE FUNCTION public.salvar_despesa(_d jsonb, _pagadores jsonb, _partes jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.expense := jsonb_populate_record(NULL::public.expense, _d);
  _outra uuid;
  s numeric;
  so numeric;
  _primeiro uuid;
BEGIN
  IF r.id IS NULL OR r.trip_id IS NULL THEN RAISE EXCEPTION 'Despesa incompleta.'; END IF;
  SELECT trip_id INTO _outra FROM public.expense WHERE id = r.id;
  IF _outra IS NOT NULL AND _outra <> r.trip_id THEN RAISE EXCEPTION 'Despesa de outra viagem.'; END IF;
  IF NOT app_private.owns_trip(r.trip_id) THEN RAISE EXCEPTION 'Só o organizador lança despesas.'; END IF;
  IF jsonb_array_length(coalesce(_pagadores, '[]')) = 0 THEN RAISE EXCEPTION 'Falta quem pagou.'; END IF;
  SELECT sum((x->>'valor_moeda_base')::numeric), sum((x->>'valor_original')::numeric) INTO s, so FROM jsonb_array_elements(_pagadores) x;
  IF abs(s - r.valor_moeda_base) > 0.005 OR abs(so - r.valor_original) > 0.005 THEN RAISE EXCEPTION 'A soma de quem pagou não fecha com o total.'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(_pagadores) x WHERE NOT EXISTS (
      SELECT 1 FROM public.trip_member m WHERE m.trip_id = r.trip_id AND m.person_id = (x->>'person_id')::uuid AND m.deleted_at IS NULL)) THEN
    RAISE EXCEPTION 'Quem pagou precisa estar na viagem.';
  END IF;
  IF coalesce(r.pessoal, false) THEN
    IF r.pessoal_de IS NULL THEN RAISE EXCEPTION 'Despesa pessoal precisa dizer de quem é.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.trip_member m WHERE m.trip_id = r.trip_id AND m.person_id = r.pessoal_de AND m.deleted_at IS NULL) THEN
      RAISE EXCEPTION 'A pessoa precisa estar na viagem.';
    END IF;
  ELSE
    r.pessoal_de := NULL;
    IF jsonb_array_length(coalesce(_partes, '[]')) = 0 THEN RAISE EXCEPTION 'Falta a divisão.'; END IF;
    SELECT sum((x->>'valor_moeda_base')::numeric) INTO s FROM jsonb_array_elements(_partes) x;
    IF abs(s - r.valor_moeda_base) > 0.005 THEN RAISE EXCEPTION 'A divisão não fecha com o total.'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(_partes) x WHERE NOT EXISTS (
        SELECT 1 FROM public.trip_member m WHERE m.trip_id = r.trip_id AND m.person_id = (x->>'person_id')::uuid AND m.deleted_at IS NULL)) THEN
      RAISE EXCEPTION 'Só participantes da viagem entram na divisão.';
    END IF;
  END IF;
  _primeiro := (_pagadores->0->>'person_id')::uuid;

  INSERT INTO public.expense (id, trip_id, descricao, categoria, data, valor_original, moeda_original, taxa_cambio, valor_moeda_base,
    pago_por, comprovante_url, criado_por, taxa_fonte, taxa_data, pessoal, pessoal_de, divisao, taxa_provisoria, item_tipo, item_id)
  VALUES (r.id, r.trip_id, r.descricao, r.categoria, r.data, r.valor_original, r.moeda_original, r.taxa_cambio, r.valor_moeda_base,
    _primeiro, r.comprovante_url, auth.uid(), r.taxa_fonte, r.taxa_data, coalesce(r.pessoal, false), r.pessoal_de, coalesce(r.divisao, 'igual'),
    coalesce(r.taxa_provisoria, false), r.item_tipo, r.item_id)
  ON CONFLICT (id) DO UPDATE SET descricao = EXCLUDED.descricao, categoria = EXCLUDED.categoria, data = EXCLUDED.data,
    valor_original = EXCLUDED.valor_original, moeda_original = EXCLUDED.moeda_original, taxa_cambio = EXCLUDED.taxa_cambio,
    valor_moeda_base = EXCLUDED.valor_moeda_base, pago_por = EXCLUDED.pago_por, comprovante_url = EXCLUDED.comprovante_url,
    taxa_fonte = EXCLUDED.taxa_fonte, taxa_data = EXCLUDED.taxa_data, pessoal = EXCLUDED.pessoal, pessoal_de = EXCLUDED.pessoal_de,
    divisao = EXCLUDED.divisao, taxa_provisoria = EXCLUDED.taxa_provisoria, editado_em = now();

  UPDATE public.expense_payer SET deleted_at = now() WHERE expense_id = r.id AND deleted_at IS NULL;
  INSERT INTO public.expense_payer (expense_id, person_id, valor_original, valor_moeda_base)
  SELECT r.id, (x->>'person_id')::uuid, (x->>'valor_original')::numeric, (x->>'valor_moeda_base')::numeric FROM jsonb_array_elements(_pagadores) x;

  UPDATE public.expense_share SET deleted_at = now() WHERE expense_id = r.id AND deleted_at IS NULL;
  IF NOT coalesce(r.pessoal, false) THEN
    INSERT INTO public.expense_share (expense_id, person_id, peso, valor_moeda_base)
    SELECT r.id, (x->>'person_id')::uuid, coalesce((x->>'peso')::numeric, 1), (x->>'valor_moeda_base')::numeric FROM jsonb_array_elements(_partes) x;
  END IF;

  IF r.item_tipo = 'ticket' THEN UPDATE public.ticket SET expense_id = r.id WHERE id = r.item_id AND trip_id = r.trip_id;
  ELSIF r.item_tipo = 'lodging' THEN UPDATE public.lodging SET expense_id = r.id WHERE id = r.item_id AND trip_id = r.trip_id;
  ELSIF r.item_tipo = 'reservation' THEN UPDATE public.reservation SET expense_id = r.id WHERE id = r.item_id AND trip_id = r.trip_id;
  END IF;
  RETURN r.id;
END $$;
REVOKE ALL ON FUNCTION public.salvar_despesa(jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_despesa(jsonb, jsonb, jsonb) TO authenticated;