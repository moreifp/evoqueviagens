# Evoque Viagens — regras para agentes

O projeto saiu do Lovable em out/2026 e é mantido só com o Claude. Os planos de funcionalidade escritos na época estão em `docs/planos/`.

Dependentes em `person` pertencem à pessoa indicada por `parent_person_id` (não à lista inteira da conta); a conta continua controlando o acesso por `account_id`, preservando a separação entre fichas.

Arquivos “Outro” escolhidos para o Cofre ficam cifrados integralmente no aparelho e em `vault_document`, separados de `traveler_document` e dos anexos compartilháveis, para que somente a conta proprietária possa abri-los.
- Visual "Colorido/Clássico": preferência só no aparelho (localStorage evoque-visual) e classe .visual-classico no <html>; cores novas usam classes cartao-*/novo-* que o CSS neutraliza no clássico — permite voltar ao visual antigo sem publicar.
- O PWA procura atualizações ao abrir, voltar ao primeiro plano e recuperar a internet; a nova versão recarrega cada tela uma única vez ao assumir o controle, preservando os caches de anexos e logos.
- O worker é registrado com a versão publicada lida de /sw-precache.js (sem cache), não com a versão da tela aberta — assim um aparelho preso numa casca antiga ainda instala a nova versão.
- Registros de saúde ficam em tabela exclusiva com acesso apenas à conta dona da pessoa, sem compartilhar via blocos, porque medicações e condições são dados sensíveis.
