-- Cópias no Google Drive do organizador: um registro por arquivo da viagem já enviado
-- (anexos de passagens/hospedagem/reservas, recibos de despesas e fotos).
-- Só o servidor escreve (service role); ninguém lê pelo cliente.
create table if not exists public.drive_backup (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trip(id) on delete cascade,
  bucket text not null,
  storage_path text not null,
  -- 'original' = original da foto vindo do aparelho; 'arquivo' = o que está no storage
  origem text not null default 'arquivo',
  pasta text not null,
  drive_file_id text not null,
  created_at timestamptz not null default now(),
  unique (bucket, storage_path, origem)
);
create index if not exists drive_backup_trip_idx on public.drive_backup(trip_id);
alter table public.drive_backup enable row level security;
revoke all on public.drive_backup from anon, authenticated;
