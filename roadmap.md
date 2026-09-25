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
