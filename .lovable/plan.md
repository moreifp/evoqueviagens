# Módulo 2 · Viagem, parte 3 — participantes (enviar e receber)

Inclui os dois pendentes da parte 2: duplicação tudo-ou-nada e o teste 8 (organizador × membro). Migrations só aditivas, cadastro pessoal intocado, tudo offline, nenhuma publicação, nenhum envio a pessoa real.

## 0. Duplicar viagem tudo-ou-nada
- Nova função no banco `duplicar_viagem(origem, novo_id, nome, cidades, inicio, fim, moeda)` que, numa única transação, cria a viagem, copia participantes (menos o dono, que entra pelo gatilho existente) e copia só as reservas manuais com seus participantes, deslocando os dias. Qualquer erro desfaz tudo.
- Só quem organiza a viagem de origem pode duplicar.
- A tela "Nova viagem" chama essa função em vez de várias gravações soltas. Sem internet: a chamada inteira entra na fila como uma única operação (novo tipo "rpc" na fila) e a viagem aparece na hora com o ID local; se o servidor recusar ao sincronizar, a viagem local é retirada e aparece aviso.

## 1. Adicionar participantes (organizador, tela Pessoas)
- Escolha com um toque em cartões grandes com avatar: "Eu", "Minha família" (dependentes), "Quem compartilha comigo" e "Convidar".
- Estado inicial automático: `aceito` se for eu, meu dependente, ou se a conta da pessoa tem confiança ativa em mim (`trip_trust`); nos demais casos `convidado`. Essa decisão é feita no banco (gatilho na entrada do participante), não no aparelho.
- "Convidar" (sem conta): nome, e-mail ou WhatsApp, idioma português/inglês. Cria um pré-cadastro da pessoa (reaproveitando o fluxo existente de pré-cadastro por link) e o participante como `convidado`. Gera mensagem pronta:
  - WhatsApp: `api.whatsapp.com/send` com texto no idioma escolhido.
  - E-mail: link `mailto:` com assunto e texto prontos (o app não dispara e-mail sozinho, então nada vai para pessoa real no teste).
- Ao criar conta/entrar com o mesmo e-mail do convite, o pré-cadastro é ligado à conta (fluxo que já existe) e a viagem aparece esperando aceite.

## 2. Receber (participante, topo da aba Viagens)
- Substitui o espaço reservado por um cartão por convite: "Diego adicionou você a Portugal 2026 · 18 a 28/10".
- Resumo do que é dele, vindo de uma leitura segura nova (`convites_recebidos`): quantos voos no nome dele e assento, hotéis e quarto, trens, carros (com "motorista" quando for o papel). Sem mostrar dados de outras pessoas antes de aceitar.
- Caixa "Receber do Diego sem perguntar — próximas viagens dele entram direto": grava ou revoga `trip_trust`.
- Aceitar: status `aceito`. Recusar: status `recusado`; some da lista dele; nada do organizador é apagado.
- Itens adicionados depois a uma viagem aceita aparecem direto (já é assim, porque a visão depende do status aceito).
- Vale também para dependentes: quem recebe é a conta do responsável.
- Em "Quem vê seus dados" entra a lista "Recebo viagens direto de…" com "Parar".

## 3. Visão do participante
A tela da viagem muda conforme quem abre:
- "SEU PRÓXIMO" no gradiente, com assento e localizador copiável.
- "O que é seu": voos, quarto e reservas em que está, com detalhe completo e voucher (regras de acesso atuais já liberam isso).
- "A viagem": roteiro em resumo (hora, título, quem) pela leitura `roteiro_viagem` já existente.
- "Quem vai": avatares e a frase "Você vê nomes e horários. Documentos de cada um, só o organizador vê."
- "Adicionar meu voo ou reserva — comprou por fora? Coloque aqui": cria item com autoria do participante; ele edita só o que criou (regra atual); o organizador vê "Adicionado por Marcos".
- "Pedir correção ao organizador": mensagem curta gravada em `trip_notice` (tipo `pedido_correcao`, enviada pelo participante); aparece para o organizador na visão da viagem com "Resolvido".

## 4. Organizador vê o estado de cada um
- Chips: Aceitou (verde) · Esperando (âmbar) · Recusou (vermelho) · Sem conta (âmbar) com "Lembrar" por WhatsApp ou e-mail, usando a mesma mensagem do convite.

## 5. Offline
- O "baixar viagem" do participante inclui a visão dele (itens dele, roteiro resumido, quem vai) e os convites recebidos.
- Aceitar, recusar, ligar/desligar "sem perguntar", adicionar participante, pedir correção e criar item próprio passam pela fila offline. Convidar por WhatsApp/e-mail precisa de conexão só para abrir o app de mensagens.

## 6. Teste (só contas e e-mails descartáveis `@example.com`)
1. Conta A organiza; conta B; convidado C sem conta.
2. A cria viagem com voo para A, B e um dependente de A; dependente e A entram aceitos, B esperando.
3. B vê o convite com o resumo só do que é dele; aceita e liga "sem perguntar".
4. A cria outra viagem com B: B recebe direto, aceito.
5. C cria conta com o e-mail do convite e vê o convite esperando.
6. B adiciona o próprio voo; A vê "Adicionado por B".
7. B tenta editar item de A (bloqueado) e tentar ler documentos de qualquer pessoa (bloqueado), pela tela e direto no banco.
8. B recusa uma terceira viagem; A vê "Recusou"; itens de A intactos.
9. B pede correção; A vê o pedido.
10. Teste 8 da parte 2: permissões organizador × membro, tela "Eu", documentos e compartilhamento pessoal continuam iguais.
11. Duplicar: forçar falha na cópia (reserva inválida) e confirmar que nenhuma viagem, participante ou reserva fica gravada; depois duplicar com sucesso.
12. Offline: B baixa a viagem, sem internet abre a visão dele e aceita um convite; sincroniza ao voltar.
13. Apagar contas, pessoas, viagens, itens e arquivos de teste; conferir zero sobras no banco e armazenamento.
Entrega: resultado de cada teste, migrations, arquivos alterados e prints (convite recebido, visão do participante, Pessoas do organizador).

## Detalhes técnicos
- Migration aditiva:
  - `public.duplicar_viagem(...)` SECURITY DEFINER, checa `owns_trip(origem)`, tudo em uma função plpgsql (atômica).
  - Gatilho BEFORE INSERT em `trip_member` definindo status `aceito` quando pessoa é do dono da viagem (`account_id`/`owner_id` = dono) ou quando existe `trip_trust` ativo (`account_id` da pessoa, `organizer_id` = dono, `revogado_em is null`); caso contrário força `convidado`.
  - `public.convites_recebidos()` SECURITY DEFINER: convites `convidado` de pessoas com `account_id = auth.uid()` ou `owner_id = auth.uid()` (dependentes), com nome do organizador, datas e contagens/assento/quarto só das linhas dessas pessoas.
  - Permitir que o responsável responda pelo dependente em `trip_member` (ajuste no guard/policy de update usando `owner_id`).
  - `trip_notice`: policy de insert para participante aceito com `tipo = 'pedido_correcao'` e `enviado_por = auth.uid()`; organizador lê/resolve.
  - Colunas novas em `trip_member`: `convite_email text`, `convite_telefone text`, `convite_idioma text default 'pt'`, `lembrado_em timestamptz` (nulas).
- Fila offline: novo tipo de operação `rpc` (nome + argumentos), executado em ordem como os demais.
- Nova tela/segmentos em `trip.$id.index.tsx` (visão organizador × participante), `trip.$id.pessoas.tsx` (seletor e estados), `viagens.tsx` (cartões de convite), `compartilhamentos.tsx` (lista de confiança), `nova-viagem.tsx` (RPC), `lib/data.ts` e `lib/offline.ts` (novas leituras no download).
- Nada em `person`/documentos/fidelidade/cofre/share_* é alterado em schema; o pré-cadastro reaproveita o fluxo atual.
