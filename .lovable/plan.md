# Módulo 2 · Viagem, parte 4 — "Está tudo certo?", pedir dados e avisos

Migrations só aditivas. Cadastro pessoal só lido, pelas permissões que já existem (bloco Documentos do share_grant ou dependente próprio). Offline via "baixar viagem" e fila. Nada publicado. Nenhuma mensagem vai para pessoa real.

Princípio: o app avisa, não garante e nunca bloqueia. Frases de visto sempre no formato "sem exigência registrada em <data> · confirme no consulado", com a fonte.

## 1. Tela "Está tudo certo?" (só o organizador)
- Substitui a tela Revisão atual da viagem e tem duas abas: **Pessoas** e **Datas e hotéis**. A aba Datas e hotéis reaproveita os achados que o auditor já faz.
- Um cartão por participante, nesta ordem: Resolver (vermelho), depois Sem acesso ou Esperando (âmbar), depois Conferir (azul), por último Tudo certo (verde).
- **Com o bloco Documentos liberado, ou dependente do próprio organizador:**
  - Validade do passaporte, sempre marcada como "regra geral · confirme" e editável por destino. Schengen: valer 3 meses depois da saída. Outros destinos: 6 meses depois da chegada.
  - Nome no bilhete comparado com o nome no passaporte. Reaproveita a conferência de nomes que já existe.
  - Visto ou autorização eletrônica, só quando houver regra cadastrada.
  - Vacina e seguro, quando estiverem cadastrados.
- **Sem o bloco:** "Não liberou documentos · não dá para conferir" e o botão "Pedir documentos".
- **Sem conta:** "Ainda sem conta · convite enviado" e o botão "Lembrar pelo WhatsApp".
- **Regras de entrada:** tabela nova, que começa vazia.
  - Sem regra para o par nacionalidade × destino: "Sem regra cadastrada para este destino · confira no consulado".
  - Regra verificada há mais de 180 dias: aparece como "não verificado".
- **Ajuste da regra do passaporte por destino:** fica guardado na própria viagem. O organizador pode trocar os meses e a base (saída ou chegada). O cadastro de regras de entrada não muda.

## 2. Pedir dados (do organizador para o participante)
- O cartão abre a tela "Pedir para Gabriela" com:
  - Blocos pré-marcados pelo que a viagem precisa: Documentos, Fidelidade e Preferências. Emergência vem desmarcado.
  - Prazo: "Até o fim da viagem" (padrão) ou "Sempre".
  - Envio: "Pedir no app" ou "WhatsApp". O WhatsApp manda um link que abre o pedido na conta dela.
- **Na conta da participante:**
  - Aparece um cartão "Diego quer ver seus dados · para Portugal 2026 · até 28/10", com Recusar e "Escolher e aceitar".
  - Usa a tela de aceitar compartilhamento que já existe, com a frase "Ele só vê. Não edita nada seu. Senhas do cofre nunca vão."
- **Prazo "Até o fim da viagem":** o acesso concedido também expira no fim da viagem. Depois dessa data, o banco deixa de liberar os documentos e o cartão volta para "Sem acesso".
- **Pedido para dependente:** vai para a conta do responsável.

## 3. Avisos
- No achado do cartão, "Enviar aviso" abre uma mensagem pronta e editável, com atalhos Passaporte · Visto · Vacina · Seguro. Exemplo: "Seu passaporte vence 15/12/2026. Para Portugal ele precisa valer até 28/01/2027. Dá para renovar antes?"
- O aviso pode ser enviado no app, pelo WhatsApp ou pelos dois.
- **Para o participante:** o aviso aparece como faixa âmbar tocável na tela Eu e no cartão da viagem.
  - Some sozinho quando o documento em questão é atualizado.
  - Também some com o botão "Já resolvi".
  - Se for de um dependente, vai para o responsável.

## 4. Offline
- A tela "Está tudo certo?" entra no "baixar viagem" do organizador.
- Os avisos da pessoa entram no download da tela Eu.
- Criar pedido, enviar aviso e tocar em "Já resolvi" passam pela fila offline. Abrir o WhatsApp precisa de internet.

## 5. Teste (só contas e e-mails `@example.com`)
1. A organiza com:
   - B: liberou documentos, passaporte vencendo antes do limite.
   - C: não liberou documentos.
   - Um dependente de A, sem passaporte.
   - D: sem conta.
2. Conferir cada cartão (cor, texto e ordem) e a frase "Sem regra cadastrada".
3. A pede documentos a C. C aceita com prazo até o fim da viagem, e o cartão de C passa para conferir.
4. A manda aviso a B. B vê o aviso na tela Eu e no cartão da viagem.
5. B atualiza o passaporte e o aviso some. Testar também "Já resolvi" em outro aviso.
6. Simular o fim da viagem: o acesso de C expira e o cartão volta para "Sem acesso".
7. B e C não veem a tela nem os documentos de ninguém, nem pela tela nem direto no banco.
8. Offline: A abre a tela sem internet e envia um aviso, que sincroniza quando a internet volta.
9. Conferir se a regra de 3 ou 6 meses e o ajuste por destino estão certos.
10. Apagar contas, pessoas, viagens, pedidos, avisos e arquivos de teste, e conferir zero sobras.

Entrega: resultado de cada teste, migrations, arquivos alterados e prints (tela Pessoas, pedir dados, pedido recebido, aviso na tela Eu).

## Detalhes técnicos
- **Migration aditiva:**
  - `entry_rule`:
    - Colunas: `nacionalidade char(2)`, `pais_destino char(2)`, `exigencia text`, `detalhe`, `estadia_max_dias`, `validade_passaporte_min_meses`, `lead_time_dias`, `fonte_url text not null`, `verificado_em date not null`.
    - Leitura para authenticated, escrita só para admin. Fica sem dados.
  - `trip`: novas colunas `validade_passaporte_meses int` e `validade_base text` ('saida' ou 'chegada'), ambas nulas. Nulo significa usar o padrão.
  - `trip_notice`: novas colunas `documento_id uuid` e `campo text`, ambas nulas.
    - Gatilho em `traveler_document` (AFTER UPDATE/INSERT, sem mudar o schema dessa tabela) marca `resolvido_em` nos avisos abertos da pessoa para aquele tipo.
    - Policy de update para quem responde pela pessoa (dono da conta ou responsável) poder marcar "Já resolvi".
    - Policy de select para esse mesmo responsável.
  - `share_grant.expira_em` já existe. A leitura dos documentos pelas funções e policies atuais passa a ignorar grants vencidos (`expira_em < now()`).
  - `share_invite`: pedido com `direcao='pedido'` e `trip_id`. Ao aceitar, `expira_em` do grant recebe o fim da viagem quando o prazo escolhido é esse.
  - `conferir_viagem(_tid)`: SECURITY DEFINER, só para o organizador. Para cada membro devolve status, acesso (liberado, sem acesso, sem conta, dependente), dados mínimos do passaporte (validade, nome) e vacina/seguro, somente quando o acesso existe. O cálculo das datas é feito em TypeScript puro no auditor.
- **Front:**
  - `trip.$id.revisao.tsx` reescrita.
  - Novo `src/lib/conferencia.ts` com as regras puras e as mensagens prontas.
  - Nova rota `trip.$id.pedir.$pid.tsx`.
  - Novo componente `AvisoForm`.
  - Novo componente `AvisosEu` na tela Eu e na lista de viagens.
  - Cartão de pedido recebido junto de ConvitesRecebidos.
  - `offline.ts` e `data.ts` ganham as consultas novas.
