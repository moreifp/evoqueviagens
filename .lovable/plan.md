# Evoque sem internet (etapa offline)

## 0. Correção imediata
- Reagendar o job `status-voos-15min` para chamar `https://evoqueviagens.lovable.app/api/public/hooks/status-voos`. Nada mais muda no AeroDataBox.

## 1. Primeiro: a tela de viagem em branco no teste
O que já sei (lido no código e no navegador de teste):
- Não é o servidor rodando a consulta sem sessão. O AuthGate desenha uma tela vazia no servidor e só mostra as telas depois de ler a sessão no aparelho, então as telas de viagem nunca rodam no servidor.
- No navegador de teste, a consulta de bilhetes ficou "carregando" para sempre (fetching, nenhuma falha), enquanto a rede mostrava respostas 200 repetidas. Até a moldura de "Carregando…" não aparecia, e todas as rotas constavam como "success".
- Causa ainda NÃO confirmada. Hipóteses em ordem: (a) trava de sessão do cliente de login (a sessão injetada pelo teste renova o token enquanto `garantirMinhaFicha` e as consultas disputam a mesma trava); (b) o cache restaurado do aparelho sobrescrevendo a consulta em andamento; (c) React mantendo a tela anterior durante a navegação.
- Passo: reproduzir com login pela própria tela de entrar (sem injetar sessão), depois isolar cada hipótese. Se acontecer também com login normal, é problema real e será corrigido nesta etapa (é o mesmo caminho que o modo sem internet usa). Vou dizer qual foi.

## 2. O que muda para o usuário
- O app abre no avião em qualquer tela, mesmo uma nunca aberta antes, com os dados guardados.
- Viagens próximas ou em andamento, a ficha Eu e os dependentes ficam baixados sozinhos quando há internet. No topo da viagem aparece um selo discreto: "Disponível sem internet · atualizado há 2 h" ou "Baixando…".
- Anexos de bilhete, hotel e os seus documentos (e dos dependentes) abrem sem internet. Documentos compartilhados por outras pessoas não ficam no aparelho.
- Sem internet, nunca aparece a tela de login. O app entra em modo leitura com o que está guardado e renova a sessão quando a rede volta.
- Erros sem internet não recarregam a página: mostram "Tentar de novo".
- Um convite, uma vez só, para "Adicionar à tela de início" (no iPhone: Compartilhar → Adicionar à Tela de Início), com "Agora não".
- Editar e apagar bilhete, hotel e despesa sem internet aparece na hora, com "1 alteração esperando internet", e sobe sozinho depois.

## 3. Detalhes técnicos
- **O1/O2 — service worker:** um script pós-build gera a lista de todos os arquivos de `dist/client` com um hash de versão e grava `sw.js` com essa lista. A instalação pré-cacheia tudo e a ativação apaga caches `evoque-*` antigos. Navegação: rede primeiro; sem rede, devolve o shell do app guardado (HTML da raiz pré-cacheado), e `/offline.html` só se nem o shell existir. `/~oauth` e `/api/` ficam fora. O `sw.js` continua escrito à mão (o app já tem um), sem trocar por `vite-plugin-pwa`, para não mudar o esquema de atualização em produção. Continua sem registro em prévia ou iframe, com `?sw=off` para desligar. Se preferir `vite-plugin-pwa`, me diga.
- **Shell e dados:** as telas de viagem hoje buscam os dados na hora de abrir. Vou garantir que todas as consultas usem o cache do aparelho (já existe cache no IndexedDB por 30 dias) e que nenhuma espere a rede quando há dado guardado.
- **O3 — baixar viagem:** `src/lib/baixarOffline.ts` roda ao abrir o app e ao voltar a rede, com intervalo mínimo de 30 min. Viagens não arquivadas com `data_fim >= hoje - 0` e até 60 dias à frente (mais as em andamento): pré-carrega nas mesmas chaves de consulta usadas pelas telas (trip, tickets, lodging, expense, trip_member, consistency_finding, flight_status) e também a ficha Eu, documentos, fidelidade e dependentes. Guarda "baixado em" por viagem no IndexedDB para o selo.
- **O4 — anexos:** baixa os arquivos pelos links assinados e grava no Cache Storage `evoque-anexos` (chave = caminho no storage), somente para arquivos de ticket/lodging dessas viagens e documentos da própria conta e dependentes. Ao abrir um anexo: usa a cópia guardada se não houver rede, senão usa o link assinado. Arquivos que não são mais usados são apagados na próxima sincronização.
- **O5 — sessão:** o AuthGate lê a sessão guardada no localStorage. Se `!navigator.onLine` e existe sessão (mesmo vencida), entra em modo leitura. `garantirMinhaFicha` só roda online, sem bloquear a tela. No evento `online` renova a sessão; se a renovação falhar, aí sim pede login.
- **O6:** o ErrorComponent do __root só recarrega sozinho se `navigator.onLine`.
- **O7:** chama `navigator.storage.persist()` uma vez. Convite de instalação usando `beforeinstallprompt` (Android/desktop) ou a instrução do iPhone, lembrado no localStorage.
- **O8:** Outfit e Inter em woff2 em `/public/fonts`, com `@font-face` em styles.css. Remove os links do Google Fonts.
- **Fila offline:** revisar editar/apagar de bilhete, hotel e despesa para passar por `mutar()` de `src/lib/outbox.ts`, com atualização imediata no cache de consultas e contador de pendências no aviso de conexão.
- Sem migrations. Não toca em tabelas do cadastro pessoal. Não publica.

## 4. Teste (resultado mostrado no fim)
Build de produção servido localmente (o SW não roda na prévia). Conta e viagem descartáveis com bilhete, hotel, despesa e um anexo. Passos: instala o SW → abre a viagem uma vez → modo offline → abre visão da viagem, bilhetes, hotéis, despesas e uma tela nunca aberta (ex.: Revisão) → abre o anexo → edita uma despesa offline (aparece na hora e com "1 alteração esperando internet") → volta online → confere no banco que sincronizou. Depois apago conta, viagem e arquivos.
