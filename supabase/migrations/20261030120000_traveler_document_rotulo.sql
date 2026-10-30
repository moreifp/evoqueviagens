-- Nome livre do documento (ex.: "RG Panamá", "Passaporte Italiano"), usado no tipo "outro".
ALTER TABLE public.traveler_document ADD COLUMN IF NOT EXISTS rotulo text;
