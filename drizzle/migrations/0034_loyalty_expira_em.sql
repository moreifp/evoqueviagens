ALTER TABLE public.loyalty_account ADD COLUMN expira_em date;
COMMENT ON COLUMN public.loyalty_account.expira_em IS 'Data de vencimento dos pontos/milhas ou da categoria (opcional).';