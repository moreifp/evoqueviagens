# Corrigir leitura de documentos em PDF

## Mudanças
- Renderizar cada página do PDF separadamente, começando pela primeira e tentando a segunda somente quando necessário.
- Manter largura útil próxima de 2.000 px e criar uma segunda versão com margens brancas removidas automaticamente.
- Usar a versão legada do PDF.js com fallback sem worker, registrando a etapa exata quando houver falha.
- Exibir a página renderizada como miniatura e mostrar um motivo curto abaixo de “Não deu para ler”.
- No passaporte, preservar os campos legíveis mesmo quando a MRZ não passar integralmente na validação, sempre exigindo confirmação.

## Validação
- Gerar um PDF A4 de passaporte espécime com MRZ ICAO e executar PDF → imagem → IA → campos.
- Gerar um PDF A4 de CNH espécime com frente e verso e executar o mesmo caminho.
- Conferir erros de código e o fluxo em viewport móvel; não publicar.

## Limite
- Alterar apenas o fluxo de leitura de documentos PDF e sua apresentação durante a leitura.
