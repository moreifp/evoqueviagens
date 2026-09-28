# Roadmap — Módulo 2 partes 1 e 2

## Recibo em texto (despesas)
- [x] Transcrever a foto da conta em texto legível na despesa (botão "Ler a conta", cache offline) — testado na tela com recibo espécime, estado restaurado



- [x] Migrations 0014–0016 (modelo, permissões, roteiro_viagem, membros_viagem, anexos trip/)
- [x] Aeroportos embarcados + fuso automático
- [x] Formulários completos bilhete/hotel/reserva + anexos múltiplos
- [x] Editar/Apagar com Desfazer (bilhete, hotel, reserva, tirar pessoa)
- [x] Barra de 4 abas dentro da viagem
- [x] Offline: roteiro, reservas e anexos no "baixar viagem"; escritas pela fila
- [x] Auditor por pessoa
- [x] Teste A/B por API (34/34) + telas + limpeza
- [x] Editar sem internet: confirmar na versão instalada (o teste na prévia não conclui, ver relatório)

## Parte 2 — desenho aprovado

- [x] Excluir somente a pessoa “Beto Teste” e confirmar ausência de vínculos/sobras
- [x] Migration aditiva: cidades, cancelamento grátis e vínculo item→despesa
- [x] Ajustar tokens claros e conferir a área “Eu”
- [x] Redesenhar Viagens e visão da viagem
- [x] Criar tela Adicionar com leitura assistida por IA e fallback manual
- [x] Criar detalhes de voo, hotel e reservas
- [x] Implementar duplicação, copiar para volta e virar despesa
- [x] Preservar e validar cobertura offline completa
- [x] Rodar os 10 testes, gerar cinco capturas e apagar todos os dados descartáveis
- [x] Não publicar

## Módulo 2 · Parte 4 — conferir, pedir dados, avisos
- [x] Migration 0022 (entry_rule vazia, regra por viagem, pedir/responder, conferir_viagem, gatilho de aviso tolerante a falha)
- [x] Telas: Está tudo certo?, Pedir dados, avisos na tela Eu/Viagens, pedidos recebidos
- [x] Teste: gatilho forçado a falhar não impede salvar documento
- [x] Rodar os 10 testes, prints, zero sobras; não publicar

## Lugares e marcas
- [x] Ligar Google Maps gerenciado; migration 0023 (place_id, site, tz)
- [x] Campo "Buscar lugar" (hotel, reserva, restaurante) + fuso pela coordenada
- [x] Abrir no mapa / Como chegar / Ver o dia no mapa
- [x] Logos: código pronto; aguarda o dono criar a conexão Logo.dev
- [x] Teste completo + zero sobras; não publicar

## Chegou pelo Claude
- [x] Migration 0024 agent_inbox (aditiva, RLS dono)
- [x] Funções propor_*/listar/detalhar/rodar_revisao (sessão de quem chama)
- [x] Extrair montarOps* dos formulários; teste antes/depois pela tela (voo, hotel, reserva) igual
- [x] Tela Chegou pelo Claude + chips + botão em Adicionar; offline pela fila
- [x] 9 testes + comparação antes/depois; zero sobras; não publicar; não ligar MCP
- [x] Ligar o MCP (dono, em Agent integrations)

## Revisão final (noite de 25/09)
- [x] Varredura de segurança e linter do banco revisados; nada crítico explorável
- [x] Build de produção limpo e tipos sem erro
- [x] Fumaça em 22 telas com conta descartável: nenhuma em branco ou com erro
- [x] Busca de lugar espera 600 ms
- [x] WhatsApp de "Lembrar"/"Aviso" usa o telefone da ficha quando a pessoa liberou o bloco básico (migration 0025)
- [x] Dados de teste apagados; 7 pessoas reais intactas

## Depende do dono
- [x] Assinar AeroDataBox no RapidAPI (status de voo)
- [x] Publicar
- [x] Ligar o MCP em Agent integrations
- [x] Criar a conexão Logo.dev
- [x] Testar offline no celular com o app instalado
- [x] (opcional) Ligar a proteção contra senhas vazadas nas configurações de login

## Resumo de validades “Em ordem”
- [x] Regras puras de validade e prazo por tipo de documento
- [x] Painel expansível na tela Eu, substituindo o aviso isolado
- [x] Próxima viagem em 90 dias e dependentes
- [x] Modo leitura condicionado ao bloco Documentos
- [x] Cache/download offline, acessibilidade e testes descartáveis
- [x] Limpeza com zero sobras; não publicar

## Domínio app.evoque.global (set/2026)
- [x] Landing em evoque.global/www; telas redirecionam 301 para app.evoque.global (evoqueviagens.lovable.app idem); MCP/.well-known/API/OAuth livres
- [x] Manifesto e service worker só no app; SW antigo se desfaz na landing com aviso
- [x] Links de convite/pedido/WhatsApp/MCP → app.evoque.global
- [x] Dono: domínio app.evoque.global está "falhou na configuração" — tentar de novo em Configurações → Domínios ANTES de publicar
- [x] Depois do domínio ativo: trocar a tarefa agendada do status de voo para app.evoque.global
- [x] Links de Termos e Privacidade da landing ([LINK])

## Aba Restaurantes (embed Evoque Restaurants)
- [x] Dono: salvar a senha compartilhada no formulário seguro (RESTAURANTS_SSO_SECRET)
- [x] Salvar o ID da conexão (evoque-viagens) e testar com conta descartável; zero sobras
- [x] Dono: pedir ao Restaurants para limitar o frame a app.evoque.global, evoqueviagens.lovable.app e a prévia

## Avisos no celular (push) — Firebase
- [x] Migration aditiva: push_device, push_pref, push_log (RLS só o dono)
- [x] Cliente: SDK sob demanda, sw.js existente, só app.evoque.global/localhost, permissão só após toque, iPhone exige instalação
- [x] Servidor: enviarAviso via conector FCM, com preferências, silêncio 22h–7h, dedupe 6h e push_log
- [x] Gatilhos: status de voo, aviso do organizador, convite, chegou pelo Claude, documento vencendo (diário), check-in 24h (desligado)
- [x] Tela "Avisos no celular" na área Eu com liga/desliga por tipo e aviso de teste
- [x] Testes com conta @example.com, simulação sem push real, zero sobras; não publicar
- [x] Dono: ligar o conector Firebase Cloud Messaging com a conta de serviço

## Landing pública aprovada — Evoque Viagens / Travels
- [x] Integrar integralmente as 10 páginas PT/EN do pacote aprovado
- [x] Adicionar /landing-preview e manter toda a revisão noindex
- [x] Isolar estilos, tema, fontes e fotos editoriais do aplicativo
- [x] Preservar separação por host, autenticação, PWA, caches, MCP/OAuth e rotas privadas
- [x] Validar build/tipos, desktop, tablet, celular, links e interações; não publicar

## Cinco pedidos do Fausto (25/09)
- [x] 1. Seletor com todas as moedas ISO 4217 + busca + offline; cotação automática com fonte/data, manual se faltar
- [x] 2. Bagagem por passageiro no bilhete + linha compacta + leitura por IA
- [x] 3. Status do voo na data local; mensagem "a partir de DD/MM"; Google com data
- [x] 4. Ficha completa agrupada, obrigatórios só passaporte e emergência, "Não tenho"
- [x] 5. Colar e-mail da agência (novo, Adicionar e edição com merge), sem preços, anexo privado

- [x] Corrigido: seção "Avisos no celular" agora aparece também na prévia ("Ligue no app instalado")

- [x] Despesas: exportar planilha Excel (formato Splitwise)
- [x] Despesas: exportar a mesma planilha em PDF
- [x] Leitura de PDF (passaporte/CNH) com testes
- [x] ETA com .eml aparece como passaporte e "Não deu para ler"

## Dependentes na tela Eu
- [x] Renomear Família para Dependentes e mostrar somente dependentes ligados à pessoa aberta
- [x] Associar novos dependentes à pessoa aberta e preservar os antigos na ficha do titular
- [x] Incluir dependentes de dependentes no download offline



## Link só das despesas
- [ ] Link público só leitura das despesas

## Hospedagem em quadro preto
- [ ] Cartão de hospedagem no mesmo quadro escuro dos bilhetes
