ALTER TABLE public.traveler_document DROP CONSTRAINT traveler_document_tipo_chk;
ALTER TABLE public.traveler_document ADD CONSTRAINT traveler_document_tipo_chk CHECK (tipo = ANY (ARRAY['passaporte','visto','esta','eta_canada','eta_uk','etias','k_eta','outro_visto','rg','cnh','pid','vacina','outra_vacina','seguro','global_entry']));
ALTER TABLE public.person ADD COLUMN IF NOT EXISTS visto_negado boolean, ADD COLUMN IF NOT EXISTS visto_negado_detalhe text;
ALTER TABLE public.person_preferences ADD COLUMN IF NOT EXISTS refeicao_voo text;