ALTER TABLE public.cadastro_link ADD COLUMN IF NOT EXISTS token_cifrado text;
ALTER TABLE public.cadastro_link ALTER COLUMN expira_em SET DEFAULT (now() + interval '30 days');
ALTER TABLE public.app_admin ADD COLUMN IF NOT EXISTS telefone text;
COMMENT ON COLUMN public.cadastro_link.token_cifrado IS 'Token AES-GCM encrypted with server secret LINK_TOKEN_KEY; decrypted only by admin-checked server function.';
REVOKE ALL ON public.cadastro_link FROM anon;