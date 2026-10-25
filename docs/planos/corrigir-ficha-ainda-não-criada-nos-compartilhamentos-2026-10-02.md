# Corrigir "Ficha ainda não criada" nos compartilhamentos

## O que está acontecendo
Os dois compartilhamentos estão ativos e completos (Fausto → Diego e Diego → Fausto, todos os blocos). As fichas dos dois também existem.

O defeito está na tela Compartilhamentos: para montar o botão "Abrir dados", o app procura a ficha da outra pessoa por um campo antigo, que ficou vazio depois que as fichas passaram a pertencer à conta. Sem achar nada, a tela mostra "Ficha ainda não criada", embora a ficha exista. Isso afeta todo mundo que recebe um compartilhamento, não só vocês dois.

## Correção
- Procurar a ficha de quem compartilhou pela ficha "Eu" da conta dessa pessoa (o jeito atual), mantendo o campo antigo só como reserva.
- Nenhuma mudança no banco nem nos seus dados.
- Testar: abrir Compartilhamentos com a conta do Fausto e conferir que o Diego aparece com "Abrir dados" e a ficha abre (e o contrário, se houver sessão disponível).

Antes de mudar, informo o ponto de volta atual. Não publico sem você pedir.

## Detalhe técnico
Em `listarCompartilhamentos` (`src/lib/compartilhar.functions.ts`), trocar a busca `person.user_id in donos` por `person.account_id in donos and kind = 'self' and deleted_at is null`, caindo para `user_id` quando não achar. Conferido no banco: nos 2 compartilhamentos ativos, 0 fichas por `user_id` e 1 por `account_id`/`self`.
