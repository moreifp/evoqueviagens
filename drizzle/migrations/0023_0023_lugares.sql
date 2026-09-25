ALTER TABLE public.lodging ADD COLUMN IF NOT EXISTS place_id text, ADD COLUMN IF NOT EXISTS site text, ADD COLUMN IF NOT EXISTS tz text;
ALTER TABLE public.reservation ADD COLUMN IF NOT EXISTS place_id text, ADD COLUMN IF NOT EXISTS site text;

CREATE OR REPLACE FUNCTION public.pontos_viagem(_tid uuid)
RETURNS TABLE (item_tipo text, item_id uuid, titulo text, inicio_utc timestamptz, tz text, lat double precision, lng double precision, place_id text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT app_private.can_view_trip(_tid) THEN RETURN; END IF;
  RETURN QUERY
  SELECT 'lodging'::text, l.id, l.nome, l.checkin, coalesce(l.tz,'UTC'), l.lat::double precision, l.lng::double precision, l.place_id
  FROM public.lodging l WHERE l.trip_id = _tid AND l.deleted_at IS NULL AND (l.lat IS NOT NULL OR l.place_id IS NOT NULL)
    AND app_private.can_view_item_detail('lodging', l.id)
  UNION ALL
  SELECT 'reservation'::text, r.id, r.titulo, r.inicio_utc, r.inicio_tz, r.lat::double precision, r.lng::double precision, r.place_id
  FROM public.reservation r WHERE r.trip_id = _tid AND r.deleted_at IS NULL AND (r.lat IS NOT NULL OR r.place_id IS NOT NULL)
    AND app_private.can_view_item_detail('reservation', r.id);
END $$;
REVOKE ALL ON FUNCTION public.pontos_viagem(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pontos_viagem(uuid) TO authenticated;