# “Em ordem” — resumo de validades na tela Eu

Sem publicação e sem alteração destrutiva. O painel será calculado no aparelho usando as consultas que já ficam guardadas para uso offline.

## 1) Regras puras de validade
- Criar um módulo TypeScript para classificar cada documento como vermelho, âmbar, verde ou neutro, com os limites exatos pedidos para passaporte, vistos/autorizações, CNH/PID, seguro, Global Entry/TSA e febre amarela.
- Produzir os textos de prazo em pt-BR, mês/ano do próximo vencimento, rótulos detalhados e progresso visual de 4 px.
- Ignorar passaportes antigos já marcados como substituídos/vencidos. Como o modelo atual não tem um campo próprio para substituição, considerar essa marcação no campo de detalhe; não será criada migration nesta mudança visual.
- Manter documentos sem validade como neutros e febre amarela como “vitalícia”.

## 2) Componente reutilizável
- Criar o componente “Em ordem” logo abaixo do cartão de perfil e remover o aviso âmbar isolado atual.
- Estado normal: selo verde fechado por padrão, com próximo vencimento e seta; abrir/fechar sem modal e guardar a escolha no aparelho por pessoa.
- Estado de atenção: selo âmbar ou vermelho já aberto, foco nos itens urgentes, pílulas dos demais e botão “Atualizar …”, que abre o documento já cadastrado com acesso direto a “Novo”.
- Painel aberto: documentos ordenados por gravidade e data, linhas inteiras tocáveis, texto do prazo e barra de tempo; alvos de toque de 56 px e texto secundário de pelo menos 15 px.
- Sem documentos: preservar somente “Fotografar seu primeiro documento”. Pedidos e avisos permanecem onde estão.

## 3) Viagem próxima e dependentes
- Encontrar a próxima viagem iniciando nos próximos 90 dias e avaliar os documentos da própria pessoa com a mesma regra de passaporte usada em “Está tudo certo?”.
- Mostrar a linha da viagem com destino, data e resultado; tocar abre a revisão dessa viagem quando a tela estiver disponível para o usuário.
- Carregar os documentos dos dependentes da conta e resumir o pior estado de cada um; tocar abre a ficha do dependente.
- Reaproveitar as consultas com cache offline e incluir esses dados no download local já existente, sem chamada nova durante o cálculo.

## 4) Compartilhamento e privacidade
- Usar o mesmo componente na ficha em modo leitura somente quando os documentos vierem liberados pelas permissões atuais.
- Se o bloco Documentos não estiver liberado, o resumo não aparece e nenhuma informação de validade é inferida ou revelada.
- Ações de atualização aparecem apenas para o dono da ficha.

## 5) Aparência e acessibilidade
- Adicionar tokens semânticos para os fundos e bordas claros pedidos (`#eef6f0`, `#b9d6c1`, `#fbf3e6`, `#e8d2ad`) e equivalentes de tema escuro; componentes não usarão cores literais.
- Título em Outfit 19 px, contraste AA, ícone e texto além da cor, foco visível, botão expansível com `aria-expanded` e barras com rótulo acessível.

## 6) Testes e limpeza
- Testar com conta descartável: nenhum documento; todos em ordem fechado e aberto; CNH a 60 dias em âmbar com botão Atualizar; passaporte a 5 meses em vermelho; viagem a 30 dias; dependente sem passaporte; modo avião.
- Conferir também o modo compartilhado com e sem o bloco Documentos.
- Validar tipos, build e telas em celular; apagar conta, documentos, dependente e viagem de teste e confirmar zero sobras. Não publicar.

## Arquivos previstos
- Novo componente do resumo e novo módulo puro de cálculo.
- Ajustes em `EuDashboard`, consultas da área Eu, cache/download offline, tokens globais e testes.
- Sem migration prevista; se a inspeção durante a implementação revelar que a marca de passaporte substituído não existe nos dados atuais, manteremos a leitura do campo de detalhe e registraremos essa limitação no resultado final, sem mudar o cadastro pessoal.