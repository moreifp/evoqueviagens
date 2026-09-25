# Ligar a aba Restaurantes ao Evoque Restaurants

O lado do Viagens já está pronto: o passe que ele cria tem tudo que o Restaurants pediu (e-mail, ID único, validade de 5 min e o ID da conexão). Falta só guardar o ID e a senha e testar.

## Passos
1. **Guardar o ID da conexão**: salvo `evoque-viagens` como configuração (não é secreto).
2. **Guardar a senha**: abro um formulário seguro para você colar a **mesma senha** que salvou no Restaurants. Ela não passa pelo chat.
3. **Endereço**: já aponta para `https://food.evoque.guru`. Nada a mudar.
4. **Teste real na prévia, com conta descartável**:
   - abrir a aba Restaurantes: a conta nova é criada lá automaticamente e aparece a tela de termos;
   - fechar e abrir de novo: entra na mesma conta (ligada pelo e-mail);
   - reabrir um link já usado: aparece a mensagem de "abra de novo pelo Viagens";
   - conferir que a renovação automática mantém a sessão viva sem recarregar.
   - No fim, apagar a conta descartável daqui. A conta criada no Restaurants eu listo para você apagar lá (não tenho acesso ao banco dele).
5. **Nada publicado**, cadastro pessoal intocado, sem migration.

## Para você mandar ao Restaurants (limitar quem pode embutir)
Peça para liberar o frame só a estes endereços:
- https://app.evoque.global
- https://evoqueviagens.lovable.app
- https://id-preview--ed787434-5ecb-4cd1-86c6-bb105f4dda51.lovable.app (prévia, para testes)

## Detalhes técnicos
- Segredos: `RESTAURANTS_CLIENT_ID` (set_secret) e `RESTAURANTS_SSO_SECRET` (add_secret). `RESTAURANTS_URL` fica no padrão do código.
- Token atual: HS256, `aud=evoque-viagens`, `jti` UUID, `exp=iat+300` (dentro do limite de 15 min), `email_verified=true`, só emitido para e-mail confirmado.
- Opcional futuro: aceitar `&next=/dining` na URL do iframe (não incluso agora).
