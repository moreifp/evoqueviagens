create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated, service_role;

create or replace function app_private.owns_trip(_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trip t
    where t.id = _trip_id and t.owner_id = auth.uid()
  )
$$;

revoke all on function app_private.owns_trip(uuid) from public, anon;
grant execute on function app_private.owns_trip(uuid) to authenticated, service_role;

drop policy if exists trip_member_own on public.trip_member;
create policy trip_member_own on public.trip_member for all to authenticated
  using (app_private.owns_trip(trip_id)) with check (app_private.owns_trip(trip_id));

drop policy if exists ticket_own on public.ticket;
create policy ticket_own on public.ticket for all to authenticated
  using (app_private.owns_trip(trip_id)) with check (app_private.owns_trip(trip_id));

drop policy if exists lodging_own on public.lodging;
create policy lodging_own on public.lodging for all to authenticated
  using (app_private.owns_trip(trip_id)) with check (app_private.owns_trip(trip_id));

drop policy if exists expense_own on public.expense;
create policy expense_own on public.expense for all to authenticated
  using (app_private.owns_trip(trip_id)) with check (app_private.owns_trip(trip_id));

drop policy if exists finding_own on public.consistency_finding;
create policy finding_own on public.consistency_finding for all to authenticated
  using (app_private.owns_trip(trip_id)) with check (app_private.owns_trip(trip_id));

drop function if exists public.owns_trip(uuid);