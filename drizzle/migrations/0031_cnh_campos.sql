ALTER TABLE public.traveler_document ADD COLUMN IF NOT EXISTS primeira_habilitacao date;
ALTER TABLE public.traveler_document ADD COLUMN IF NOT EXISTS local_expedicao text;