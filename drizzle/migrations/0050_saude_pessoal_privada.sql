CREATE TABLE public.person_health_entry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.person(id),
  tipo text NOT NULL CHECK (tipo IN ('remedio', 'medico', 'condicao')),
  nome text NOT NULL CHECK (char_length(btrim(nome)) BETWEEN 1 AND 160),
  dose text CHECK (dose IS NULL OR char_length(dose) <= 160),
  foto_data text CHECK (foto_data IS NULL OR (char_length(foto_data) <= 1400000 AND foto_data ~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$')),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_health_entry TO authenticated;
GRANT ALL ON public.person_health_entry TO service_role;
ALTER TABLE public.person_health_entry ENABLE ROW LEVEL SECURITY;
CREATE POLICY person_health_owner_select ON public.person_health_entry FOR SELECT TO authenticated USING (app_private.owns_person(person_id));
CREATE POLICY person_health_owner_insert ON public.person_health_entry FOR INSERT TO authenticated WITH CHECK (app_private.owns_person(person_id));
CREATE POLICY person_health_owner_update ON public.person_health_entry FOR UPDATE TO authenticated USING (app_private.owns_person(person_id)) WITH CHECK (app_private.owns_person(person_id));
CREATE INDEX person_health_entry_person_active ON public.person_health_entry (person_id, created_at) WHERE deleted_at IS NULL;