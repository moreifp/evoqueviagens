create table if not exists public.trip_oculta (
  account_id uuid not null default auth.uid(),
  trip_id uuid not null references public.trip(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (account_id, trip_id)
);
grant select, insert, delete on public.trip_oculta to authenticated;
grant all on public.trip_oculta to service_role;
alter table public.trip_oculta enable row level security;
create policy trip_oculta_own on public.trip_oculta for all to authenticated
  using (account_id = auth.uid()) with check (account_id = auth.uid());

create or replace function app_private.grant_trip(_tid uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from public.trip t join public.share_grant g on g.owner_id = t.owner_id
    where t.id = _tid and g.grantee_id = auth.uid() and g.status = 'ativo' and 'viagens' = any(g.blocos)
      and (g.trip_ids is null or t.id = any(g.trip_ids))
      and (g.expira_em is null or g.expira_em > now()))
  and not exists (select 1 from public.trip_oculta o where o.trip_id = _tid and o.account_id = auth.uid())
$$;