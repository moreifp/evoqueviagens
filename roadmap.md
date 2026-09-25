# Roadmap — Módulo 2 partes 1 e 2

- [x] Migrations 0014–0016 (modelo, permissões, roteiro_viagem, membros_viagem, anexos trip/)
- [x] Aeroportos embarcados + fuso automático
- [x] Formulários completos bilhete/hotel/reserva + anexos múltiplos
- [x] Editar/Apagar com Desfazer (bilhete, hotel, reserva, tirar pessoa)
- [x] Barra de 4 abas dentro da viagem
- [x] Offline: roteiro, reservas e anexos no "baixar viagem"; escritas pela fila
- [x] Auditor por pessoa
- [x] Teste A/B por API (34/34) + telas + limpeza
- [ ] Editar sem internet: confirmar na versão instalada (o teste na prévia não conclui, ver relatório)

## Parte 2 — desenho aprovado

- [ ] Excluir somente a pessoa “Beto Teste” e confirmar ausência de vínculos/sobras
- [ ] Migration aditiva: cidades, cancelamento grátis e vínculo item→despesa
- [ ] Ajustar tokens claros e conferir a área “Eu”
- [ ] Redesenhar Viagens e visão da viagem
- [ ] Criar tela Adicionar com leitura assistida por IA e fallback manual
- [ ] Criar detalhes de voo, hotel e reservas
- [ ] Implementar duplicação, copiar para volta e virar despesa
- [ ] Preservar e validar cobertura offline completa
- [x] Rodar os 10 testes, gerar cinco capturas e apagar todos os dados descartáveis
- [ ] Não publicar

## Módulo 2 · Parte 4 — conferir, pedir dados, avisos
- [x] Migration 0022 (entry_rule vazia, regra por viagem, pedir/responder, conferir_viagem, gatilho de aviso tolerante a falha)
- [x] Telas: Está tudo certo?, Pedir dados, avisos na tela Eu/Viagens, pedidos recebidos
- [x] Teste: gatilho forçado a falhar não impede salvar documento
- [x] Rodar os 10 testes, prints, zero sobras; não publicar

## Lugares e marcas
- [x] Ligar Google Maps gerenciado; migration 0023 (place_id, site, tz)
- [x] Campo "Buscar lugar" (hotel, reserva, restaurante) + fuso pela coordenada
- [x] Abrir no mapa / Como chegar / Ver o dia no mapa
- [ ] Logos: código pronto; aguarda o dono criar a conexão Logo.dev
- [x] Teste completo + zero sobras; não publicar

## Chegou pelo Claude
- [x] Migration 0024 agent_inbox (aditiva, RLS dono)
- [x] Funções propor_*/listar/detalhar/rodar_revisao (sessão de quem chama)
- [x] Extrair montarOps* dos formulários; teste antes/depois pela tela (voo, hotel, reserva) igual
- [x] Tela Chegou pelo Claude + chips + botão em Adicionar; offline pela fila
- [x] 9 testes + comparação antes/depois; zero sobras; não publicar; não ligar MCP
- [ ] Ligar o MCP (dono, em Agent integrations)

## Revisão final (noite de 25/09)
- [x] Varredura de segurança e linter do banco revisados; nada crítico explorável
- [x] Build de produção limpo e tipos sem erro
- [x] Fumaça em 22 telas com conta descartável: nenhuma em branco ou com erro
- [x] Busca de lugar espera 600 ms
- [x] WhatsApp de "Lembrar"/"Aviso" usa o telefone da ficha quando a pessoa liberou o bloco básico (migration 0025)
- [x] Dados de teste apagados; 7 pessoas reais intactas

## Depende do dono
- [ ] Assinar AeroDataBox no RapidAPI (status de voo)
- [ ] Publicar
- [ ] Ligar o MCP em Agent integrations
- [ ] Criar a conexão Logo.dev
- [ ] Testar offline no celular com o app instalado
- [ ] (opcional) Ligar a proteção contra senhas vazadas nas configurações de login

## Resumo de validades “Em ordem”
- [ ] Regras puras de validade e prazo por tipo de documento
- [ ] Painel expansível na tela Eu, substituindo o aviso isolado
- [ ] Próxima viagem em 90 dias e dependentes
- [ ] Modo leitura condicionado ao bloco Documentos
- [ ] Cache/download offline, acessibilidade e testes descartáveis
- [ ] Limpeza com zero sobras; não publicar

## Domínio app.evoque.global (set/2026)
- [x] Landing em evoque.global/www; telas redirecionam 301 para app.evoque.global (evoqueviagens.lovable.app idem); MCP/.well-known/API/OAuth livres
- [x] Manifesto e service worker só no app; SW antigo se desfaz na landing com aviso
- [x] Links de convite/pedido/WhatsApp/MCP → app.evoque.global
- [ ] Dono: domínio app.evoque.global está "falhou na configuração" — tentar de novo em Configurações → Domínios ANTES de publicar
- [ ] Depois do domínio ativo: trocar a tarefa agendada do status de voo para app.evoque.global
- [ ] Links de Termos e Privacidade da landing ([LINK])
