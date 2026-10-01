<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

Dependentes em `person` pertencem à pessoa indicada por `parent_person_id` (não à lista inteira da conta); a conta continua controlando o acesso por `account_id`, preservando a separação entre fichas.

Arquivos “Outro” escolhidos para o Cofre ficam cifrados integralmente no aparelho e em `vault_document`, separados de `traveler_document` e dos anexos compartilháveis, para que somente a conta proprietária possa abri-los.
- Visual "Colorido/Clássico": preferência só no aparelho (localStorage evoque-visual) e classe .visual-classico no <html>; cores novas usam classes cartao-*/novo-* que o CSS neutraliza no clássico — permite voltar ao visual antigo sem publicar.
- O PWA procura atualizações ao abrir, voltar ao primeiro plano e recuperar a internet; a nova versão recarrega cada tela uma única vez ao assumir o controle, preservando os caches de anexos e logos.
- O worker é registrado com a versão publicada lida de /sw-precache.js (sem cache), não com a versão da tela aberta — assim um aparelho preso numa casca antiga ainda instala a nova versão.
