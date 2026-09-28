CREATE TABLE public.trip_photo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trip(id),
  storage_path text NOT NULL,
  largura integer,
  altura integer,
  tirada_em timestamptz,
  criado_por uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX trip_photo_trip_idx ON public.trip_photo(trip_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.trip_photo TO authenticated;
GRANT ALL ON public.trip_photo TO service_role;
ALTER TABLE public.trip_photo ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION app_private.is_trip_owner(_tid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.trip WHERE id = _tid AND owner_id = auth.uid() AND deleted_at IS NULL)
$$;
GRANT EXECUTE ON FUNCTION app_private.is_trip_owner(uuid) TO authenticated;

CREATE POLICY trip_photo_select ON public.trip_photo FOR SELECT TO authenticated
  USING (app_private.can_view_trip(trip_id));
CREATE POLICY trip_photo_insert ON public.trip_photo FOR INSERT TO authenticated
  WITH CHECK (app_private.is_trip_owner(trip_id) AND criado_por = auth.uid());
CREATE POLICY trip_photo_update ON public.trip_photo FOR UPDATE TO authenticated
  USING (app_private.is_trip_owner(trip_id)) WITH CHECK (app_private.is_trip_owner(trip_id));

CREATE OR REPLACE FUNCTION app_private.foto_trip(_name text) RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN split_part(_name, '/', 1) ~ '^[0-9a-f-]{36}$' THEN split_part(_name, '/', 1)::uuid END
$$;
GRANT EXECUTE ON FUNCTION app_private.foto_trip(text) TO authenticated;

CREATE POLICY fotos_viagem_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fotos-viagem' AND app_private.can_view_trip(app_private.foto_trip(name)));
CREATE POLICY fotos_viagem_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fotos-viagem' AND app_private.is_trip_owner(app_private.foto_trip(name)));
CREATE POLICY fotos_viagem_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'fotos-viagem' AND app_private.is_trip_owner(app_private.foto_trip(name)));