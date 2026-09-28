CREATE TABLE public.despesas_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trip(id),
  token text NOT NULL UNIQUE,
  criado_por uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  revogado_em timestamptz
);
CREATE INDEX despesas_link_trip_idx ON public.despesas_link(trip_id);
GRANT SELECT, INSERT, UPDATE ON public.despesas_link TO authenticated;
GRANT ALL ON public.despesas_link TO service_role;
ALTER TABLE public.despesas_link ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organizador vê links" ON public.despesas_link FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trip t WHERE t.id = trip_id AND t.owner_id = auth.uid()));
CREATE POLICY "Organizador cria links" ON public.despesas_link FOR INSERT TO authenticated
  WITH CHECK (criado_por = auth.uid() AND EXISTS (SELECT 1 FROM public.trip t WHERE t.id = trip_id AND t.owner_id = auth.uid()));
CREATE POLICY "Organizador revoga links" ON public.despesas_link FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trip t WHERE t.id = trip_id AND t.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trip t WHERE t.id = trip_id AND t.owner_id = auth.uid()));