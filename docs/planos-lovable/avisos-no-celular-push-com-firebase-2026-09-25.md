# Avisos no celular (push) com Firebase

Lembretes de voo, avisos do organizador, convites, itens do Claude e documentos vencendo — direto no celular, só em app.evoque.global. Nada publicado; o dono publica.

## 1) Banco (migration aditiva `0026_push`)
- **push_device**: id, account_id, token (único), plataforma, user_agent curto, criado_em, visto_em, ativo. RLS: cada conta só lê/grava/apaga os próprios aparelhos.
- **push_pref**: account_id, chave por tipo de aviso (todos ligados, exceto lembrete de check-in), horário de silêncio (padrão 22h–7h, exceto voo nas próximas 24h). RLS só o dono.
- **push_log**: tipo, ref_id, destino, status, erro, enviado_em — dedupe e auditoria.
- Cadastro pessoal (person, traveler_document, document_attachment, loyalty_account, vault_*, share_*) intocado.

## 2) Cliente
- SDK Firebase carregado sob demanda (só ao ligar os avisos); configuração pública no código como constante, sem Analytics.
- Recebimento em segundo plano integrado ao `public/sw.js` existente (eventos push + notificationclick), mantendo precache e offline intactos; getToken usa o registro atual do sw.js.
- Só em app.evoque.global e localhost. Permissão só depois de um toque. iPhone sem app instalado: mensagem "instale: Compartilhar → Adicionar à Tela de Início".
- Token renovado a cada abertura se mudar; ao sair da conta, o token do aparelho é apagado.
- App aberto: toast discreto em vez de notificação do sistema. Toque na notificação abre a tela certa (URL relativa).

## 3) Envio (servidor, via conector Firebase Cloud Messaging)
- Função `enviarAviso(account_id, tipo, titulo, corpo, url, ref_id)`: respeita preferências, silêncio, dedupe (mesmo tipo+ref_id não repete em 6h) e grava push_log. Tokens inválidos (UNREGISTERED) viram ativo=false.
- Gatilhos: (a) status do voo mudou (atraso ≥15 min, portão, cancelado, embarque) no cron existente; (b) aviso do organizador (trip_notice); (c) convite para viagem; (d) itens chegaram pelo Claude (agrupados); (e) documento vencendo antes de viagem marcada (job diário, no máx. 1 por documento por semana, sem número de documento no texto); (f) check-in 24h antes — desligado por padrão.
- Textos curtos em português, sem dado sensível (nada de localizador, número de documento ou nomes completos de terceiros).

## 4) Tela
- Na área Eu: "Avisos no celular" com botão grande "Ligar avisos neste aparelho", estado atual (ligado / bloqueado no navegador / instalar no iPhone), chave por tipo de aviso, horário de silêncio, "Mandar aviso de teste" e "Desligar neste aparelho". Mesma linguagem visual (alvos ≥56 px, texto ≥18 px, Lucide).

## 5) Testes (conta @example.com descartável)
- Registrar token falso, conferir RLS (outra conta não vê), disparar enviarAviso em modo simulação para cada gatilho e conferir dedupe, silêncio e preferências no push_log; conferir que o sw.js continua abrindo o app offline. Apagar tudo, zero sobras. Nenhum push real para pessoas.

## O que falta do dono
1. Ligar o conector **Firebase Cloud Messaging** no projeto com a conta de serviço (ele cola o JSON no formulário seguro). Se ainda não estiver ligado quando eu codar o envio, deixo tudo pronto atrás do conector e aviso.
2. No fim, o passo a passo para o teste real no celular dele.

## Detalhes técnicos
- Envio via gateway do conector (`FIREBASE_MESSAGING_API_KEY` + `LOVABLE_API_KEY`), nunca do cliente; FCM HTTP v1 `projects/_/messages:send`.
- Sem segundo service worker; sw.js ganha handlers push/notificationclick com payload {title, body, url}.
- Jobs: status-voos-15min existente ganha chamada de aviso; novo job diário para documentos (pg_cron → rota /api/public com segredo de cron).
