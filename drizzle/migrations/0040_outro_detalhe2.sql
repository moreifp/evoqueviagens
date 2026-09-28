ALTER TABLE public.traveler_document ADD COLUMN detalhe2 text;
COMMENT ON COLUMN public.traveler_document.detalhe2 IS 'Segundo campo livre de detalhe (tipo "outro"); não propaga para outros fluxos.';