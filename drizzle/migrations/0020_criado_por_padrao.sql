ALTER TABLE public.ticket ALTER COLUMN criado_por SET DEFAULT auth.uid();
ALTER TABLE public.lodging ALTER COLUMN criado_por SET DEFAULT auth.uid();
ALTER TABLE public.reservation ALTER COLUMN criado_por SET DEFAULT auth.uid();
ALTER TABLE public.trip_notice ALTER COLUMN enviado_por SET DEFAULT auth.uid();