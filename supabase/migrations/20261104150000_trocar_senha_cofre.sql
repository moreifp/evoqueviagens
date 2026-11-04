-- Trocar a senha do cofre: o aparelho decifra tudo com a senha antiga e cifra de novo
-- com a nova; o servidor só recebe o resultado já cifrado e grava tudo de uma vez
-- (ou nada), para nunca ficar metade com a chave antiga e metade com a nova.
-- SECURITY INVOKER: as regras de acesso (só a conta dona) continuam valendo.
CREATE OR REPLACE FUNCTION public.trocar_senha_cofre(_verificador_antigo text, _meta jsonb, _itens jsonb, _docs jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _n int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Entre na sua conta'; END IF;
  -- Outro aparelho trocou a senha no meio do caminho: não sobrescreve.
  PERFORM 1 FROM vault_meta WHERE account_id = _uid AND verifier_ciphertext = _verificador_antigo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'A senha do cofre mudou em outro aparelho. Feche e abra o cofre de novo.'; END IF;
  -- Tudo o que existe precisa vir recifrado; se faltar algo, nada é gravado.
  SELECT count(*) INTO _n FROM vault_item WHERE account_id = _uid;
  IF _n <> jsonb_array_length(_itens) THEN RAISE EXCEPTION 'O cofre mudou durante a troca. Tente de novo.'; END IF;
  SELECT count(*) INTO _n FROM vault_document WHERE account_id = _uid;
  IF _n <> jsonb_array_length(_docs) THEN RAISE EXCEPTION 'O cofre mudou durante a troca. Tente de novo.'; END IF;

  UPDATE vault_item v SET encrypted_payload = x.encrypted_payload, iv = x.iv, updated_at = now()
  FROM jsonb_to_recordset(_itens) AS x(id uuid, encrypted_payload text, iv text)
  WHERE v.id = x.id AND v.account_id = _uid;
  GET DIAGNOSTICS _n = ROW_COUNT;
  IF _n <> jsonb_array_length(_itens) THEN RAISE EXCEPTION 'O cofre mudou durante a troca. Tente de novo.'; END IF;

  UPDATE vault_document v SET encrypted_payload = x.encrypted_payload, iv = x.iv, updated_at = now()
  FROM jsonb_to_recordset(_docs) AS x(id uuid, encrypted_payload text, iv text)
  WHERE v.id = x.id AND v.account_id = _uid;
  GET DIAGNOSTICS _n = ROW_COUNT;
  IF _n <> jsonb_array_length(_docs) THEN RAISE EXCEPTION 'O cofre mudou durante a troca. Tente de novo.'; END IF;

  UPDATE vault_meta SET
    kdf_salt = _meta->>'kdf_salt',
    kdf_iterations = (_meta->>'kdf_iterations')::int,
    verifier_ciphertext = _meta->>'verifier_ciphertext',
    verifier_iv = _meta->>'verifier_iv',
    updated_at = now()
  WHERE account_id = _uid;
END $$;
REVOKE ALL ON FUNCTION public.trocar_senha_cofre(text, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trocar_senha_cofre(text, jsonb, jsonb, jsonb) TO authenticated;
