# Módulo 2 · Viagem, parte 1

Modelo com vários passageiros/quartos/hóspedes, permissões por item, fuso automático pelo aeroporto, editar/apagar completo, barra de 4 abas dentro da viagem e auditor por pessoa. Tudo continua funcionando sem internet. Sem publicar.

## 1. Banco (uma migration aditiva: `0014_viagem_modelo.sql`)

Colunas novas
- `trip_member`: status (convidado|aceito|recusado|saiu, default 'convidado'), convidado_por, respondido_em.
- `ticket`: criado_por, origem ('ui'|'agente', default 'ui'), grupo_reserva.
- `lodging`: criado_por, origem.
- `share_invite` e `share_grant`: trip_id (null). `share_grant`: expira_em (null).
- Comentários `DEPRECATED` em ticket.traveler_person_id / assento / nome_no_bilhete / anexo_url e lodging.traveler_person_id / anexo_url.

Tabelas novas (todas com GRANT a authenticated/service_role, sem anon, RLS ligado, soft delete)
- `ticket_passenger`, `lodging_room`, `lodging_guest`, `reservation`, `reservation_person`, `item_attachment`, `trip_trust`, `trip_notice` — campos exatamente como no pedido.

Gatilho: ao criar viagem, o dono entra em trip_member como 'aceito' com a ficha "Eu".

## 2. Permissões (SECURITY DEFINER em app_private)

- `acct_person(pid)`: a pessoa é o "Eu" ou um dependente da minha conta.
- `can_view_trip(tid)` (substitui a atual): dono · membro 'aceito' cujo person é meu ou dependente meu · grant "viagens" ativo, dentro de trip_ids e não expirado.
- `can_view_item_detail(tipo, id)`: dono da viagem · criado_por · passageiro/hóspede/pessoa do item que seja meu ou dependente meu.
- `can_edit_item(tipo, id)`: dono da viagem ou criado_por.
- `can_view(pid, bloco)` e as políticas por bloco passam a exigir `expira_em is null or expira_em > now()`. Documentos continuam só por `can_view(pid,'documentos')`; nenhuma regra de viagem abre documento ou foto.

Como fica o "resumo" para quem não está no item: o RLS é por linha, não por coluna. Então:
- Tabelas completas (ticket, lodging, reservation, passageiros, quartos, hóspedes, anexos) só são lidas com `can_view_item_detail`.
- Uma função `roteiro_viagem(tid)` (security definer, checa `can_view_trip`) devolve para todos os membros só título, tipo, horários/fusos, cidade/IATA e nomes de quem vai — sem localizador, e-ticket, assento, valor nem anexo.
- Escrita (insert/update) exige `can_edit_item`; insert exige `can_view_trip` e criado_por = eu.
- Anexos no storage: pasta nova `trip/{trip_id}/{item_id}/…`, liberada por `can_view_item_detail` via item_attachment.

## 3. Fuso automático

- Script gera `public/data/aeroportos.json` a partir do OurAirports (domínio público) — só aeroportos com IATA e `scheduled_service=yes` (~4 mil) — com nome, cidade, país, lat, lng e fuso IANA (calculado pela coordenada com uma tabela de fusos de domínio público). Arquivo entra no pré-cache do app.
- No bilhete: campo IATA com sugestões; ao escolher, preenche cidade e fuso. Seletor de 10 fusos some; fica "Trocar fuso" discreto.

## 4. Telas

- Formulários completos de bilhete (passageiros: pessoa, nome no bilhete, assento, e-ticket, fidelidade), hotel (quartos e hóspedes), reserva nova (carro/passeio/restaurante/outro, pessoas com papel) — o mesmo formulário serve para criar e editar, já preenchido.
- Editar/Apagar com Desfazer 10 s em bilhete, hotel, reserva e "Tirar da viagem" em pessoas. Botões só aparecem para quem pode editar.
- Itens em que a pessoa não está aparecem como cartão de resumo.
- Anexos múltiplos por item (lista, adicionar, apagar).
- Barra da viagem: troca a de 3 abas pela mesma de 4 abas de fora (Eu · Viagens · Restaurantes · Despesas).

## 5. Offline

- Novas consultas (passageiros, quartos, hóspedes, reservas, anexos, roteiro) entram no "Baixar viagem"; anexos de item_attachment vão para o cache de anexos (só os que a pessoa pode ver).
- Todas as escritas (inclusive linhas filhas: passageiros, quartos, hóspedes) passam pela fila offline, com ids gerados no aparelho para os filhos funcionarem antes de sincronizar.

## 6. Auditor

- Nome no bilhete via ticket_passenger.
- "Noite sem cama" por pessoa: entre o voo que a traz e o que a leva, cada noite precisa de um quarto com ela como hóspede; senão vira achado "Fulano sem quarto na noite de DD/MM".

## 7. Teste (resultado mostrado no fim)

Conta A: viagem com 1 voo de 3 passageiros (1 dependente), hotel com 2 quartos, reserva de carro. Conta B aceita como membro, passageira do voo, não do carro. Conferir: B vê roteiro, próprio assento, voucher do hotel dela, carro só em resumo, nenhum documento, não edita itens de A (tentativa pela API bloqueada). Editar e apagar com Desfazer online e offline. Auditor acha "pessoa sem quarto". Tudo apagado no fim; lista de migrations e arquivos.

## Detalhes técnicos

- Não toca em person, traveler_document, document_attachment, loyalty_account, vault_*; em share_* só adiciona colunas e atualiza as funções de leitura por bloco.
- Arquivos principais: `drizzle/migrations/0014_*`, `scripts/aeroportos.ts`, `public/data/aeroportos.json`, `src/lib/aeroportos.ts`, `src/lib/data.ts`, `src/lib/offline.ts`, `src/lib/anexosOffline.ts`, `src/lib/auditoria.ts`, `src/components/{FormBilhete,FormHotel,FormReserva,AnexosItem,CampoAeroporto}.tsx`, `src/components/Chrome.tsx`, rotas `trip.$id.*` (nova `trip.$id.reservas.*`), `vite.config.ts` (pré-cache do JSON).
- Ponto de atenção: `can_view_trip` hoje não considera membros; a troca é compatível porque as tabelas estão vazias.
