# Botão "Compartilhar de volta"

## O que muda para você
Na tela "Quem vê seus dados", aba "Comigo", cada pessoa que compartilha com você (ex.: Fausto) ganha um botão **"Compartilhar de volta"**.

- Tocou no botão: abre logo abaixo, no próprio cartão, a escolha do que ele vai ver (os mesmos blocos de sempre, já todos marcados; viagens: todas ou só algumas).
- Tocou em "Compartilhar": pronto. Sem link, sem convite. Ele já passa a ver seus dados, somente leitura, e recebe um aviso no celular (se tiver ligado).
- Se você já compartilha com ele, o botão vira "Você já compartilha · Mudar", que leva ao cartão na aba "Eu compartilho".
- Senhas do cofre continuam nunca indo. Dá para revogar a qualquer momento como hoje.

## Regras
- Só aparece para quem já compartilha com você (compartilhamento ativo) — ninguém consegue dar acesso a um desconhecido por esse caminho.
- Nada do cadastro pessoal é alterado; nenhuma mudança no banco (usa as tabelas de compartilhamento que já existem).
- Não publicar.

## Teste
Duas contas descartáveis @example.com: A compartilha com B; B toca "Compartilhar de volta" com alguns blocos; A vê B na aba "Comigo" com os blocos certos; B revoga; tentar compartilhar de volta com alguém que não compartilha comigo é recusado. Apagar tudo no fim.

## Detalhes técnicos
- Nova server function `compartilharDeVolta({ grantId, blocos, tripIds })` em `compartilhar.functions.ts` com `requireSupabaseAuth`: confirma que o `share_grant` está ativo e tem `grantee_id = userId`; revoga grant ativo anterior userId→owner; insere `share_grant { owner_id: userId, grantee_id: owner, blocos, trip_ids: tripsDoDono(...) }`, reaproveitando a lógica de `aceitarConvite`.
- UI em `src/routes/compartilhamentos.tsx` usando `EscolherBlocos` e invalidando `["compartilhamentos"]`.
