DROP POLICY IF EXISTS person_read ON public.person;
CREATE POLICY person_read ON public.person FOR SELECT TO authenticated USING (account_id = auth.uid() OR app_private.can_view(id, 'basico'));