# Status do voo pelo número (AeroDataBox)

Confirmado: o secret `AERODATABOX_KEY` já está salvo no backend. Nada no cadastro pessoal (pessoas, documentos, fidelidade, cofre, compartilhamento) nem nos passageiros/quartos será tocado. As mudanças no banco só acrescentam coisas. Não vou publicar.

## O que você vai ver
- **Cartão do voo (lista de bilhetes e visão da viagem):**
  - Botão "Ver status", que abre a busca do Google (ex.: `TP88`) em outra aba e funciona sem a API.
  - Chip grande: "No horário" (verde) · "Atrasado 40 min" (âmbar) · "Cancelado" (vermelho) · "Portão 12".
  - Embaixo, em letra pequena: "atualizado às 18:02 · AeroDataBox".
  - Horário revisto em destaque, com o original riscado ao lado.
  - Botão "Atualizar agora" (desativado sem internet). Sem internet, aparece o último status guardado e a hora dele.
- **Visão da viagem:** quando um horário muda ou um voo é cancelado, aparece uma faixa no topo com a frase do que mudou (ex.: "TP88 atrasou 1h10 · parte 23:40"). Nada de badge na navegação.
- **Auditor:** passa a usar o horário revisto. Se o atraso atrapalhar o check-in ou uma conexão, isso vira um achado.
- **Sem tela separada do voo:** hoje o app não tem uma tela própria para o voo, então tudo fica no cartão. Não vou criar uma tela nova.

## Consultas automáticas
- A cada 15 min, o app olha os voos que partem entre 2h atrás e daqui a 30h.
- Um voo só é consultado quando chega a vez dele:
  - 24h antes da partida;
  - 6h antes;
  - a cada 30 min nas 3h antes;
  - a cada 60 min durante o voo;
  - uma vez depois do pouso.
- Quando o mês passa de 320 unidades (80% de 400), as consultas automáticas param e o dono da viagem recebe um aviso na faixa da viagem. O limite de 400 fica num único lugar, fácil de trocar.

## Detalhes técnicos
**Migration (só acrescenta):**
- `flight_status`: as colunas pedidas, `origem` ('auto'|'manual') e um índice em `(ticket_id, consultado_em desc)`.
  - Leitura (SELECT) para quem pode ver a viagem do ticket, via `app_private.can_view_trip(ticket.trip_id)`.
  - Só o servidor grava: sem permissão de escrita para usuários.
- `api_usage (mes text PK 'YYYY-MM', unidades int, aviso_em timestamptz)`: só o servidor usa.
- Função `app_private.somar_uso(mes, n)` para somar sem risco de contagem errada quando duas consultas chegam juntas.
- `api_alerta (trip_id, mensagem, created_at)`: guarda o aviso de limite. O dono da viagem pode ler.

**Arquivos:**
- `src/lib/voo.ts`, usado pela tela e pelo servidor:
  - normalizar o número: companhia IATA + número sem zeros à esquerda (`TP 088` → `TP88`);
  - converter o nome por extenso da companhia no código IATA (LATAM→LA, TAP→TP, Azul→AD, GOL→G3, American→AA, Air France→AF, KLM→KL, Iberia→IB, United→UA, Delta→DL, Emirates→EK, Lufthansa→LH, British→BA, Copa→CM, Avianca→AV e outras);
  - data local da partida (`partida_utc` no fuso `partida_tz`);
  - tabela de "quando é a vez" de cada voo;
  - texto do chip.
- `src/lib/voo.server.ts`:
  - chama `GET https://aerodatabox.p.rapidapi.com/flights/number/{num}/{data}` com os headers do RapidAPI, enviando só o número e a data;
  - quando vêm vários trechos, escolhe pelo `origem_iata`/`destino_iata` do ticket;
  - converte a resposta para as colunas e grava a consulta junto com o uso.
- `src/lib/voo.functions.ts`: `atualizarStatusVoo({ ticket_id })` com `requireSupabaseAuth`.
  - Lê o ticket como o próprio usuário, então só funciona para quem pode ver o ticket.
  - Se a última consulta tem menos de 10 min, devolve a guardada sem chamar a API.
  - Se der erro ou não vier dado, devolve o último status guardado + "Não consegui atualizar agora."
  - Número inexistente: "Não encontrei o voo TP9999 nesta data."
  - Grava com o acesso de servidor só depois dessas verificações.
- `src/routes/api/public/hooks/status-voos.ts`: rota das consultas automáticas, protegida por `authenticateCronRequest` (`LOVABLE_CRON_SECRET`).
- Agendamento de 15 em 15 min chamando essa rota, criado por SQL fora da migration.
  - São 96 execuções por dia. Cada uma é uma consulta leve ao banco, e a API só é chamada quando é a vez de algum voo.
- `src/lib/data.ts`: nova consulta `flightStatusQuery(tripId)` (último status de cada ticket), guardada no aparelho para funcionar offline como o resto.
- `src/components/StatusVoo.tsx`: chip, horários, "Ver status", "Atualizar agora".
- `src/routes/trip.$id.bilhetes.index.tsx`, `src/routes/trip.$id.index.tsx`: usar o componente e mostrar a faixa de mudança.
- `src/lib/auditoria.ts`: repassar ao `rodarAuditor` os tickets com `partida_utc`/`chegada_utc` trocados pelo horário revisto, quando houver. O auditor em si não muda.

**Consumo estimado:** o limite de 400 unidades dá cerca de 200 consultas por mês. Um voo acompanhado do começo ao fim gasta perto de 12 consultas, ou seja, 24 unidades.

## Testes (vou mostrar o resultado)
1. Chamada real com um voo que exista hoje (TP88 GRU→LIS ou outro), usando um ticket de teste numa viagem descartável: status, portão e horário.
2. Número inexistente: mensagem clara, nada quebra.
3. Duas consultas seguidas em menos de 10 min: a segunda não gasta unidade.
4. Conferir que `api_usage` soma certo (esperado: 4 unidades no total, 2 do voo real + 2 do número inexistente).
5. Apagar a viagem, o ticket, os status e a conta de teste. Zerar em `api_usage` só as unidades que os testes gastaram, se você preferir não contar os testes; senão elas ficam registradas.

No fim: arquivos criados e alterados, migrations, unidades gastas e confirmação de que os dados de teste foram apagados.
