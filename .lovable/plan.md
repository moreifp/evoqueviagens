# Chegou pelo Claude — caixa de itens pendentes

Tudo que vier do Claude nasce **pendente** e só vira voo/hotel/reserva quando o dono toca em Confirmar. Não vou ligar Agent integrations nem publicar.

## 1) Banco — migration aditiva `0024_agent_inbox`
Tabela nova `agent_inbox` (nenhuma tabela existente é alterada):
- id, account_id (= quem chamou), trip_id (pode ficar vazio), tipo_alvo (voo | hotel | reserva | despesa), payload_json, idempotency_key, origem_cliente, lote_id, status (pendente | confirmado | descartado), achados_json, criado_em, resolvido_em, item_id.
- Chave única (account_id, idempotency_key). Se o agente não mandar uma chave, ela é calculada assim: tipo + localizador + data de início (ou nome + check-in no caso do hotel).
- Permissões: só o dono lê e atualiza. Não existe apagar, só descartar. Ele só consegue propor em viagens que já pode editar hoje, conferido pelas mesmas regras de acesso que já valem.
- Um gatilho impede editar o conteúdo depois de resolvido. Só `status`, `resolvido_em` e `item_id` mudam, e só a partir de "pendente".

## 2) Funções com nome de intenção (futuras tools do MCP)
Ficam em `src/lib/agente.functions.ts`, todas com o login de quem chama. Nenhuma usa acesso de administrador, então as permissões do banco valem sempre. O corpo de cada uma fica num arquivo só do servidor, para o MCP reaproveitar depois sem precisar reescrever. As descrições são escritas para o agente ler: datas ISO 8601 com offset, moeda ISO 4217, aeroportos IATA, e um exemplo de chamada em cada uma.
- `listar_viagens`: nome, datas, cidades e papel de quem chama.
- `detalhar_viagem(trip_id)`: roteiro resumido, usando `roteiro_viagem`, que já esconde o que a pessoa não pode ver.
- `listar_participantes(trip_id)`: só nome, apelido e se é dependente, usando `membros_viagem`. Sem documentos.
- `propor_voo(trip_id, trechos[], passageiros[], localizador, anexo?)`
- `propor_hospedagem(trip_id, hotel, quartos[], hospedes[])`
- `propor_reserva(trip_id, tipo, titulo, inicio, fim?, local?, pessoas[], localizador?, valor?, moeda?)`
- `rodar_revisao(trip_id)`: devolve os achados atuais.

Como funcionam as `propor_*`:
1. Conferem os dados. Se a data vier sem offset, recusam com uma mensagem clara em vez de adivinhar o fuso.
2. Tratam passageiros e hóspedes pelo `person_id` da viagem. Um nome que não bate com ninguém volta como aviso e não vira pessoa nova.
3. Rodam o mesmo auditor da tela (`rodarAuditor`) com o item simulado, junto com o que já existe na viagem.
4. Gravam o item em `agent_inbox` como pendente, ou devolvem o que já existe se a chave repetir. Em nenhum dos dois casos duplicam.
5. Respondem com `{ id, status, repetido, achados[] }`. Os achados vêm em frases prontas, como "o hotel acaba 21/03 e seu voo é 22/03".

Fica de fora de propósito: documentos, cofre, fidelidade, pedidos de compartilhamento, avisos, apagar, aceitar viagem e marcar despesa como paga. A despesa fica prevista na tabela, mas nesta etapa não ganha função própria.

## 3) Confirmar usa o caminho da tela
Hoje a gravação dos formulários está dentro de cada um. Vou separar essa parte em funções próprias sem mudar o que ela faz: `montarOpsVoo`, `montarOpsHotel` e `montarOpsReserva` em `src/lib/itens.ts`. Os formulários passam a chamar essas funções, e Confirmar também.
- **Confirmar:** gera as mesmas operações da tela (`enviar(ops)`, com a fila offline), junto com a marcação da caixa como confirmado e o `item_id`.
- **Editar:** abre o formulário do tipo já preenchido, pelo mesmo caminho do pré-preenchimento da IA (`evoque-import-<tripId>`). Ao salvar, o pendente vira confirmado.
- **Descartar:** marca como descartado.
- **Sem viagem:** o item aparece com "Escolher viagem" antes de poder confirmar.

## 4) Tela "Chegou pelo Claude"
- Rota nova `/trip/$id/claude` e a caixa geral em `/claude`, para itens sem viagem.
- Chip âmbar só dentro das telas: na aba Viagens ("3 itens chegaram pelo Claude · Confirmar com um toque") e na visão da viagem. Nada na navegação global.
- Cartão: ícone do tipo, título ("Voo de volta · TP 087"), origem ("De um e-mail da TAP · PDF anexo"), resumo com datas, pessoas e localizador, faixa âmbar com o achado e três botões grandes: Descartar · Editar · Confirmar.
- Rodapé com o texto pedido, explicando como mandar.
- Na tela Adicionar, "Pelo Claude" deixa de dizer "Em breve" e passa a abrir a caixa.
- O `lote_id` fica gravado, sem botão por enquanto.

## 5) Offline
- A caixa pendente da viagem entra no "baixar viagem".
- Confirmar e descartar sem internet vão pela fila. A atualização do item e a da caixa vão juntas na mesma fila, e a tela já mostra o resultado na hora.

## 6) Teste (contas `@example.com`, nada para pessoas reais)
Chamo as `propor_*` direto no servidor com o login da conta A, como o MCP chamaria:
1. Voo com 2 passageiros: fica pendente e a resposta volta sem achado grave.
2. Hotel que deixa uma noite sem cama: o achado volta na resposta.
3. Repito a mesma chamada: `repetido: true`, e continua 1 linha só.
4. Confirmo o voo: comparo bilhete e passageiros com um voo igual cadastrado pela tela, campo a campo.
5. Descarto o hotel: nada é criado.
6. Edito uma reserva no formulário e confirmo: o item é criado com a edição.
7. A conta B não vê nem resolve a caixa de A, pela tela e direto no banco. B também não consegue propor na viagem de A.
8. Offline: confirmo sem internet e o item sincroniza quando a conexão volta.
9. Limpeza: apago contas, viagem e itens, e confiro zero sobras. As 7 pessoas reais continuam intactas.

No fim entrego a lista das tools e o que o dono precisa fazer em More → Agent integrations.

## Detalhes técnicos
- As funções ficam em `agente.functions.ts`, com `requireSupabaseAuth` e validação zod. Os corpos ficam em `agente.server.ts`, para o MCP reaproveitar.
- A camada de escrita compartilhada fica em `itens.ts`: as funções `montarOps*` são puras e devolvem `Op[]`.
- A tipagem do auditor é a mesma de `audit.ts`. A simulação usa `montarEntrada` com o item novo acrescentado.
- Arquivos novos: `agente.functions.ts`, `agente.server.ts`, `routes/trip.$id.claude.tsx`, `routes/claude.tsx`, `components/CaixaClaude.tsx`.
- Arquivos alterados: `itens.ts`, `FormBilhete.tsx`, `FormHotel.tsx`, `FormReserva.tsx`, `trip.$id.adicionar.tsx`, `viagens.tsx`, `trip.$id.index.tsx`, `data.ts`, `offline.ts`, `roadmap.md`.
