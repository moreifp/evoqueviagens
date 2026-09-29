CREATE OR REPLACE FUNCTION public.salvar_despesa(_d jsonb, _pagadores jsonb, _partes jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    pago_por, comprovante_url, criado_por, taxa_fonte, taxa_data, pessoal, pessoal_de, divisao, taxa_provisoria, item_tipo, item_id, recibo_path, recibo_texto)
  VALUES (r.id, r.trip_id, r.descricao, r.categoria, r.data, r.valor_original, r.moeda_original, r.taxa_cambio, r.valor_moeda_base,
    _primeiro, r.comprovante_url, auth.uid(), r.taxa_fonte, r.taxa_data, coalesce(r.pessoal, false), r.pessoal_de, coalesce(r.divisao, 'igual'),
    coalesce(r.taxa_provisoria, false), r.item_tipo, r.item_id, r.recibo_path, r.recibo_texto)
  ON CONFLICT (id) DO UPDATE SET descricao = EXCLUDED.descricao, categoria = EXCLUDED.categoria, data = EXCLUDED.data,
    valor_original = EXCLUDED.valor_original, moeda_original = EXCLUDED.moeda_original, taxa_cambio = EXCLUDED.taxa_cambio,
    valor_moeda_base = EXCLUDED.valor_moeda_base, pago_por = EXCLUDED.pago_por, comprovante_url = CASE WHEN EXCLUDED.recibo_path IS NOT NULL OR expense.recibo_path LIKE 'trip/%' THEN EXCLUDED.comprovante_url ELSE coalesce(EXCLUDED.comprovante_url, expense.comprovante_url) END,
    taxa_fonte = EXCLUDED.taxa_fonte, taxa_data = EXCLUDED.taxa_data, pessoal = EXCLUDED.pessoal, pessoal_de = EXCLUDED.pessoal_de,
    divisao = EXCLUDED.divisao, taxa_provisoria = EXCLUDED.taxa_provisoria,
    recibo_path = coalesce(EXCLUDED.recibo_path, expense.recibo_path), recibo_texto = CASE WHEN EXCLUDED.recibo_path IS NOT NULL THEN EXCLUDED.recibo_texto ELSE expense.recibo_texto END, editado_em = now();

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
END $function$;