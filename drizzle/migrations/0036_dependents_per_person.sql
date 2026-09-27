ALTER TABLE public.person ADD COLUMN IF NOT EXISTS parent_person_id uuid REFERENCES public.person(id);
CREATE INDEX IF NOT EXISTS person_parent_person_id_idx ON public.person(parent_person_id) WHERE deleted_at IS NULL AND kind = 'dependent';
UPDATE public.person AS child SET parent_person_id = (SELECT self.id FROM public.person AS self WHERE self.account_id = child.account_id AND self.kind = 'self' AND self.deleted_at IS NULL ORDER BY self.created_at LIMIT 1) WHERE child.kind = 'dependent' AND child.parent_person_id IS NULL AND child.deleted_at IS NULL AND EXISTS (SELECT 1 FROM public.person AS self WHERE self.account_id = child.account_id AND self.kind = 'self' AND self.deleted_at IS NULL);
CREATE OR REPLACE FUNCTION public.check_dependent_parent() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kind = 'dependent' AND NEW.parent_person_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.person AS parent WHERE parent.id = NEW.parent_person_id AND parent.account_id = NEW.account_id AND parent.deleted_at IS NULL) THEN
      RAISE EXCEPTION 'O responsável pelo dependente deve pertencer à mesma conta';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS person_check_dependent_parent ON public.person;
CREATE TRIGGER person_check_dependent_parent BEFORE INSERT OR UPDATE OF parent_person_id, account_id, kind ON public.person FOR EACH ROW EXECUTE FUNCTION public.check_dependent_parent();