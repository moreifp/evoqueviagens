-- A leitura logo após inserir (RETURNING) não enxerga a linha nova dentro de funções STABLE;
-- dono e criador passam a ser checados direto nas colunas da própria linha.
DROP POLICY IF EXISTS ticket_read ON public.ticket;
CREATE POLICY ticket_read ON public.ticket FOR SELECT TO authenticated
  USING (app_private.owns_trip(trip_id) OR (criado_por = auth.uid() AND app_private.can_view_trip(trip_id)) OR app_private.can_view_item_detail('ticket', id));
DROP POLICY IF EXISTS lodging_read ON public.lodging;
CREATE POLICY lodging_read ON public.lodging FOR SELECT TO authenticated
  USING (app_private.owns_trip(trip_id) OR (criado_por = auth.uid() AND app_private.can_view_trip(trip_id)) OR app_private.can_view_item_detail('lodging', id));
DROP POLICY IF EXISTS reservation_read ON public.reservation;
CREATE POLICY reservation_read ON public.reservation FOR SELECT TO authenticated
  USING (app_private.owns_trip(trip_id) OR (criado_por = auth.uid() AND app_private.can_view_trip(trip_id)) OR app_private.can_view_item_detail('reservation', id));
