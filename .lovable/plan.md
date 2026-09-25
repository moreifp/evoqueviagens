# Módulo 2 · Viagem, parte 2

Redesenhar as telas da viagem no padrão visual da área “Eu”, acrescentar importação assistida por IA, detalhes completos, duplicação e conversão em despesa, preservando permissões e funcionamento offline. Não publicar.

## 0. Limpeza isolada de “Beto Teste”

- Excluir somente `person.id = e3b1a44d-c70c-42cc-8b11-5ba9fa8b211d`.
- Antes da exclusão, repetir a conferência de vínculos; a leitura atual encontrou apenas essa linha de pessoa e zero vínculos nas tabelas relacionadas.
- Depois, confirmar que esse ID não existe mais e que nenhuma outra pessoa foi alterada.

## 1. Migration aditiva

- Adicionar `trip.cidades text[]` para representar as cidades exibidas e copiadas na duplicação, mantendo `destino` existente por compatibilidade.
- Adicionar `lodging.cancelamento_gratis_ate date null`.
- Adicionar `expense_id uuid null references expense(id)` em `ticket`, `lodging` e `reservation`, com índices; a despesa será criada primeiro com UUID local e o item será ligado a ela na mesma fila offline.
- Atualizar apenas funções/RLS necessárias aos novos campos e às leituras permitidas. Não alterar schema nem dados de cadastro pessoal.
- Criar uma leitura permissionada para o voo retornar somente o estado da conferência do nome por passageiro: “confere”, “sem passaporte” ou “sem acesso”, sem revelar documento ou foto a quem não recebeu acesso.
- Regenerar os tipos após a migration.

## 2. Linguagem visual e componentes compartilhados

- Ajustar os tokens claros para areia `#f6f3ee`, navy `#0c1c2c`, teal `#25606a`, cartões brancos e borda `#ddd5c6`, preservando contraste mínimo de 7:1.
- Manter Outfit nos títulos, Inter no texto, ícones Lucide com traço 2.2, alvos de toque de pelo menos 56 px e texto principal de pelo menos 18 px.
- Restringir o gradiente olive→teal ao cartão principal de cada tela; usar verde, âmbar e vermelho somente para estados.
- Criar peças reutilizáveis para cabeçalhos, avatares por iniciais, chips de estado, linhas do roteiro e ações de item.

## 3. Aba Viagens

- Topo “Viagens” com “Nova viagem” acessível.
- Reservar uma faixa no topo para convites recebidos, sem implementar a lógica nesta etapa.
- Cartão principal para a viagem atual ou próxima com contagem de dias, nome, cidades, datas, organizador, avatares dos participantes e quantidade de achados vermelhos.
- Separar “Próximas” e “Passadas” em listas simples.
- “Duplicar” abre a criação de viagem com nome, cidades e participantes preenchidos, mas datas vazias. Depois que as novas datas forem informadas, copiar somente reservas manuais, preservando horários e deslocando os dias em relação ao novo início; não copiar voos, trens/ônibus tratados como bilhetes, hotéis, anexos, status de voo ou despesas.
- Toda criação/cópia usa IDs locais, atualização imediata da tela e fila offline.

## 4. Visão da viagem

- Cabeçalho com voltar, nome, período, moeda, organizador e compartilhar desativado com explicação curta de indisponibilidade.
- Cartão “PRÓXIMO” no gradiente com tipo, rota/número, horário em 44 px, dia, terminal, passageiros, chegada e status de voo quando houver.
- Faixa do achado mais grave levando à revisão.
- Grade 2×2: Transporte, Hospedagem, Reservas e Pessoas.
- Roteiro único agrupado por dia e ordenado por horário, incluindo transporte, chegadas individuais, check-in, carro e demais reservas; mostrar participantes e “Conferir” quando o achado envolver o item.
- Substituir o botão flutuante antigo de gasto por “Adicionar”, levando à nova tela; “Despesa” será a primeira opção dessa tela.

## 5. Tela Adicionar e leitura por IA

- Nova tela cheia com fechar em alvo de 56 px.
- Ação principal “Foto ou PDF da reserva” para imagem, PDF, voucher ou print; “Colar texto” usa a mesma extração; “Pelo Claude” mostra apenas a mensagem de disponibilidade futura pedida.
- Chamada autenticada e somente no servidor ao Lovable AI Gateway, com `openai/gpt-6-astra` na Responses API, entrada multimodal no MIME real e saída estruturada validada. Nenhuma chave, prompt ou lógica sensível irá ao navegador.
- A saída será uma união estrita de voo, hotel ou reserva. O resultado apenas pré-preenche o formulário correspondente e sempre exige revisão e toque em salvar.
- Em falha de leitura, preservar o erro seguro do serviço, manter o arquivo e pedir o tipo; ao escolher, abrir o formulário vazio com o arquivo pronto para ser anexado depois do primeiro salvamento.
- Sem internet, a grade manual e “Despesa” continuam funcionando; a leitura deixa claro que precisa de conexão, sem perder o arquivo escolhido.
- Grade: Despesa, Voo, Trem/ônibus, Hotel, Carro, Passeio/ingresso e Restaurante.

## 6. Tela do voo

- Criar rota de detalhe por voo e transformar as linhas/listas em links para ela.
- Bloco navy com companhia/número, dia, IATAs grandes, partida/chegada, `+1` quando aplicável, chegada no fuso de casa, localizador copiável e status do voo com “Ver status”.
- Passageiros com avatar, assento, nome no bilhete, e-ticket mascarado e o chip permissionado de conferência de nome.
- “+ Passageiro” abre a edição focada na lista de passageiros.
- “Copiar para a volta” cria outro trecho com os mesmos passageiros e `grupo_reserva`, deixando horários/rota para conferência no formulário.
- Anexos com abrir/baixar offline e anexar foto ou PDF.
- Mostrar autoria e permissão de edição; ações grandes: Editar, Virar despesa e Apagar com Desfazer.

## 7. Tela do hotel

- Criar rota de detalhe por hotel e transformar a lista em links.
- Check-in/check-out grandes lado a lado; endereço com escolha de Google Maps ou Apple Maps; localizador copiável; faixa de cancelamento grátis quando houver data.
- Quartos com nome/tipo, avatares e hóspedes, além de “+ Quarto” e “Mudar” para edição focada.
- Mostrar aviso âmbar consolidado do auditor por pessoa e noites sem quarto.
- Voucher/anexos, autoria, Editar, Virar despesa e Apagar com Desfazer.
- Acrescentar `cancelamento_gratis_ate` ao formulário e à leitura offline.

## 8. Reservas e Virar despesa

- Redesenhar lista e criar detalhe para carro, passeio, restaurante e outro.
- Carro destaca retirada, devolução e motorista; restaurante destaca horário e participantes.
- “Virar despesa” cria uma única despesa pré-preenchida com descrição, valor, moeda e data do item, liga seu `expense_id` e abre a despesa para conferência.
- Se já houver despesa ligada, abrir a existente em vez de duplicar.
- Não criar divisão entre pessoas nesta etapa.
- Ajustar a tela de despesa para aceitar e editar o pré-preenchimento, mantendo o snapshot de câmbio imutável e todas as gravações na fila offline.

## 9. Offline e compatibilidade

- Incluir cidades, conferência dos passageiros, detalhes, vínculos de despesa e qualquer nova consulta no download da viagem.
- Manter roteiro, anexos já baixados, status do voo e telas de detalhe disponíveis offline.
- Passar duplicação, cópia de volta, edição, exclusão, criação de despesa e vínculo do item pela fila offline, com atualização imediata e sincronização ordenada.
- Confirmar que “Eu”, documentos, compartilhamento pessoal, status de voo e as permissões da parte 1 continuam inalterados.

## 10. Testes e entrega

Com contas e dados descartáveis:

1. Montar pelas telas uma viagem completa com voo, hotel/quartos, carro, passeio, restaurante, participantes, anexos e achados do auditor.
2. Gerar uma imagem fictícia de bilhete, importá-la pela nova tela, conferir o pré-preenchimento e salvar manualmente.
3. Testar “Colar texto” e o fallback de arquivo ilegível sem salvamento automático.
4. Abrir e usar as telas 1 a 5 em tamanhos móvel e desktop, verificando legibilidade, alvos de toque e ausência de sobreposição.
5. Duplicar uma viagem passada e confirmar: datas inicialmente vazias, participantes e reservas manuais copiados, sem voos/hotéis/despesas/anexos/status.
6. Virar um hotel em despesa, revisar, salvar e confirmar que repetir a ação não duplica.
7. Baixar a viagem, ficar sem internet e abrir lista, visão, voo, hotel, reservas, anexos e status; criar/editar/apagar e sincronizar ao voltar.
8. Revalidar permissões entre organizador e membro, tela “Eu”, documentos e compartilhamento pessoal.
9. Apagar contas, pessoas, viagens, itens e arquivos descartáveis; consultar o banco e o armazenamento para confirmar zero sobras.
10. Entregar o resultado de cada teste, migrations e arquivos alterados, além de cinco capturas: Viagens, visão da viagem, Adicionar, voo e hotel.

## Detalhes técnicos

- Novas rotas previstas: detalhe de voo, detalhe de hotel, detalhe de reserva e `/trip/$id/adicionar`; todas terão metadados próprios.
- A importação por IA será uma função autenticada em módulo client-safe, com helper `.server.ts`; uploads continuam no armazenamento privado e respeitam as permissões do item.
- A leitura de documento usada no chip será derivada no servidor/banco e nunca ampliará o acesso do organizador ao cadastro pessoal.
- As referências obrigatórias de entrada multimodal, Responses API e tratamento de erros do Gateway serão verificadas antes da implementação e a chamada real será testada uma única vez com a imagem fictícia.
- Nenhuma publicação será feita.
