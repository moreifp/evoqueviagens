-- Pessoas da conta (listas da tela Eu/Pessoas) e voos por horário de partida
-- (job status-voos a cada 15 min, lembrete de check-in e status compartilhado por voo).
CREATE INDEX IF NOT EXISTS person_account_id_ativos_idx ON public.person (account_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ticket_voo_partida_utc_idx ON public.ticket (partida_utc) WHERE tipo = 'voo';
