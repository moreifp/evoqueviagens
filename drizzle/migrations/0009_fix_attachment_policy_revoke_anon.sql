DROP POLICY IF EXISTS document_attachment_insert ON public.document_attachment;
DROP POLICY IF EXISTS document_attachment_update ON public.document_attachment;
CREATE POLICY document_attachment_insert ON public.document_attachment FOR INSERT TO authenticated
  WITH CHECK (app_private.owns_person(document_attachment.person_id) AND EXISTS (
    SELECT 1 FROM public.traveler_document d WHERE d.id = document_attachment.document_id AND d.person_id = document_attachment.person_id
  ));
CREATE POLICY document_attachment_update ON public.document_attachment FOR UPDATE TO authenticated
  USING (app_private.owns_person(document_attachment.person_id))
  WITH CHECK (app_private.owns_person(document_attachment.person_id) AND EXISTS (
    SELECT 1 FROM public.traveler_document d WHERE d.id = document_attachment.document_id AND d.person_id = document_attachment.person_id
  ));
REVOKE ALL ON public.vault_item, public.vault_meta, public.document_attachment FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.vault_item, public.vault_meta, public.document_attachment FROM authenticated;