create table if not exists public.emergency_country (iso2 char(2) primary key, pais text not null, geral text, policia text, ambulancia text, bombeiros text, obs text, cobertura_sem_posto text, fonte_url text, fontes_postos text[], confianca text check (confianca in ('alta','media','baixa')), notas text, verificado_em date not null default date '2026-09-26', created_at timestamptz not null default now());
create table if not exists public.consular_post (id uuid primary key default gen_random_uuid(), iso2 char(2) not null references public.emergency_country(iso2) on delete cascade, tipo text not null, cidade text not null, cidade_en text, lat double precision, lng double precision, telefone text, plantao text, email text, site text, endereco text, created_at timestamptz not null default now());
create index if not exists consular_post_iso2_idx on public.consular_post(iso2);
alter table public.emergency_country enable row level security;
alter table public.consular_post enable row level security;
do $$ begin
 if not exists (select 1 from pg_policies where tablename='emergency_country' and policyname='emergency_country_read') then create policy emergency_country_read on public.emergency_country for select to authenticated using (true); end if;
 if not exists (select 1 from pg_policies where tablename='consular_post' and policyname='consular_post_read') then create policy consular_post_read on public.consular_post for select to authenticated using (true); end if;
end $$;
alter table public.trip add column if not exists emergencia jsonb;