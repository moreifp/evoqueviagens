DROP POLICY IF EXISTS trip_read ON public.trip;
CREATE POLICY trip_read ON public.trip FOR SELECT TO authenticated USING (owner_id = auth.uid() OR app_private.can_view_trip(id));