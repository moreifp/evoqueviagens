REVOKE ALL ON FUNCTION public.owns_trip(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_trip(uuid) TO authenticated;