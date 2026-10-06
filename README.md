# Evoque Viagens

Crie o **Evoque Viagens** — um app pessoal de organização de viagens, em português do Brasil, mobile-first, PWA instalável.

Esta é a **Entrega 1** de um plano de 4. Construa só o que está aqui. Não invente features fora desta lista.

---

## O QUE O APP É

Um lugar só para a viagem inteira: os bilhetes, o hotel, o que foi gasto, e um auditor que confere se as datas batem. A tela mais importante é a que se abre às 5h da manhã no aeroporto.

**Usuário único nesta entrega:** só o dono faz login. Outras pessoas existem como ficha, sem conta.

---

## REGRAS DURAS DE INTERFACE — são critério de aceite, não sugestão

Estas regras cortam funcionalidade. Se uma tela não passa nelas, ela está errada.

- **Alvo de toque mínimo 56×56 px** (acima dos 44 px da Apple).
- **Texto base 18 px.** Títulos 28–34 px. **Números de dinheiro e horas: 36 px ou mais.**
- **Contraste mínimo 7:1.** Nunca cinza-claro sobre branco — a tela é lida no sol.
- **Uma ação principal por tela**, no máximo duas secundárias.
- **No máximo 3 toques** até a ação mais comum.
- **Ícone sempre com rótulo curto embaixo.** Ícone sozinho é adivinhação.
- **Barra inferior com exatamente 3 abas.** Sem menu hambúrguer. O perfil vai no avatar do topo direito.
- Nada de parágrafo dentro do app: rótulos de 1 a 3 palavras.
- Nada de tabela densa no celular. Nada de tooltip como explicação necessária.
- **Nenhum modal bloqueante de aviso.** Nenhum aviso impede salvar.
- **Sem badge de contagem de problemas na navegação global.**

Ícones: **Lucide**, `strokeWidth={2.2}`, tamanho 28px nas telas e 26px na barra inferior.

---

## DESIGN SYSTEM — herdado do Evoque by Fausto, use exatamente estes tokens

```css
/* index.css — light */
--navy: 210 56% 11%;   --sand: 40 40% 85%;   --sand-dark: 40 30% 75%;
--olive: 75 35% 36%;   --teal: 188 46% 32%;  --wine-red: 0 60% 40%;

--background: 0 0% 100%;      --foreground: 210 56% 11%;
--card: 0 0% 100%;            --muted: 40 30% 95%;
--muted-foreground: 210 30% 40%;
--primary: 210 56% 11%;       --accent: 188 46% 32%;
--secondary: 40 40% 85%;      --border: 40 20% 88%;  --input: 40 20% 88%;
--ring: 188 46% 32%;          --radius: 0.75rem;

--gradient-olive-teal: linear-gradient(135deg,
  hsl(75,35%,36%), hsl(120,40%,34%), hsl(165,43%,33%), hsl(188,46%,32%));
--shadow-soft:   0 2px 8px -2px  hsl(210 56% 11% / 0.08);
--shadow-medium: 0 4px 16px -4px hsl(210 56% 11% / 0.12);

/* dark */
--background: 210 56% 8%;  --card: 210 50% 12%;  --muted: 210 40% 18%;
--foreground: 40 40% 95%;  --accent: 188 46% 38%; --border: 210 40% 20%;
```

Tema claro e escuro, seguindo o sistema operacional. Tipografia sans limpa (Outfit para títulos, Inter para texto). Cantos arredondados, sombras suaves.

**Cor semântica só onde significa estado:** verde recebe, vermelho resolver, âmbar conferir. Nada mais colorido — senão o vermelho do auditor perde força.

---

## BANCO DE DADOS

Crie estas tabelas com **RLS ligada desde já**. Toda tabela com `trip_id` tem policy por dono da viagem; `person`, `traveler_document` e `loyalty_account` são visíveis só para quem criou.

```
person       id uuid pk
             user_id uuid null            -- null = contato sem conta
             owner_id uuid not null       -- quem cadastrou
             nome text not null
             nome_como_no_documento text
             nacionalidades text[] default '{}'
             data_nascimento date null
             created_at, deleted_at

trip         id uuid pk
             owner_id uuid not null
             nome text not null
             destino text
             data_inicio date not null
             data_fim date not null
             moeda_base char(3) not null   -- A MOEDA DE REFERÊNCIA DA VIAGEM
             status text check in ('planejada','andamento','encerrada')
             capa_url text null
             arquivada_em timestamptz null
             created_at, deleted_at
             check (data_fim >= data_inicio)

trip_member  id uuid pk
             trip_id uuid fk trip on delete cascade
             person_id uuid fk person
             papel text check in ('owner','membro','convidado')
             entrou_em date
             unique (trip_id, person_id)

ticket       id uuid pk
             trip_id uuid fk trip on delete cascade
             tipo text check in ('voo','trem','onibus','carro','transfer')
             companhia text, numero text, localizador text
             origem_iata char(3) null, destino_iata char(3) null
             origem_cidade text, destino_cidade text
             partida_utc timestamptz not null, partida_tz text not null
             chegada_utc timestamptz not null, chegada_tz text not null
             assento text, nome_no_bilhete text
             anexo_url text null
             created_at, deleted_at
             check (chegada_utc > partida_utc)

lodging      id uuid pk
             trip_id uuid fk trip on delete cascade
             nome text not null, endereco text, cidade text
             lat double precision null, lng double precision null
             checkin timestamptz not null, checkout timestamptz not null
             localizador text, valor numeric(12,2), moeda char(3)
             politica_cancelamento text
             anexo_url text null
             created_at, deleted_at
             check (checkout > checkin)

expense      id uuid pk
             trip_id uuid fk trip on delete cascade
             descricao text not null
             categoria text not null
             data date not null
             valor_original numeric(14,2) not null check (valor_original > 0)
             moeda_original char(3) not null
             taxa_cambio numeric(18,8) not null      -- SNAPSHOT, gravada no lançamento
             valor_moeda_base numeric(14,2) not null -- materializado, em trip.moeda_base
             pago_por uuid null fk person
             comprovante_url text null
             criado_por uuid not null
             created_at, editado_em, deleted_at

consistency_finding
             id uuid pk
             trip_id uuid fk trip on delete cascade
             regra_id text not null         -- 'A1','A2','D1'...
             severidade text check in ('resolver','conferir','sugestao')
             itens_envolvidos text[]
             mensagem text not null
             hash_dos_dados text not null
             created_at
             dispensado_em timestamptz null
             unique (trip_id, regra_id, hash_dos_dados)
```

**Três regras de dados que não podem ser violadas:**

1. **Horário sempre em UTC + coluna de fuso.** `partida_utc` guarda o instante, `partida_tz` guarda o fuso IANA daquele ponto (ex.: `America/Sao_Paulo`). Exibir sempre no fuso do evento, com o horário local do usuário como legenda pequena. Um voo GRU→LIS que sai 22h35 e chega 12h15 tem que aparecer certo nas duas pontas.
2. **A taxa de câmbio é um snapshot imutável.** Gravada no momento do lançamento e **nunca recalculada**. Se recalcular, o histórico muda sozinho.
3. **Nada é apagado de verdade.** Use `deleted_at`. Viagem encerrada recebe `arquivada_em` e sai do topo da lista, mas continua inteira.

---

## AS TELAS

Barra inferior com 3 abas: **Programação** (calendário), **Restaurantes** (talher, tela vazia dizendo "chega na Entrega 4"), **Dinheiro** (cifrão).

### `/` — Minhas viagens
A viagem atual (ou a próxima) num **card enorme** com gradiente olive→teal, nome em 23px, datas e nº de pessoas embaixo, e um selo "Começa em X dias". As viagens arquivadas viram **linhas discretas** abaixo, com nome e mês. Botão grande "＋ Nova viagem" no rodapé da tela. Passado não compete com presente.

### `/trip/:id` — Visão geral (A TELA MAIS IMPORTANTE)
Precisa responder três coisas **sem scroll**: qual é o próximo compromisso, a que horas, e onde.
- **Card do próximo compromisso ocupando quase metade da área útil**, com gradiente: ícone grande do tipo (avião/cama), rota ou nome, **hora em 42px** com o `:` mais claro, e local embaixo.
- Logo abaixo, o **selo de saúde do auditor**: uma faixa só, verde / âmbar / vermelha, com **uma frase inteira** do achado — não um contador. Toque leva a `/trip/:id/revisao`.
- Grid 2×2 de atalhos com **número grande e rótulo pequeno**: Despesas (total na moeda da viagem), Bilhetes, Hospedagem, Pessoas.
- **Botão flutuante grande** (52px, gradiente) para lançar despesa, fixo em toda a área da viagem.

### `/trip/:id/bilhetes`
Cartões no formato "cartão de embarque", agrupados por data: ícone do tipo, **hora grande**, código do voo e localizador em fonte monoespaçada grande, e um botão grande "Ver documento". Campos secundários escondidos atrás de "Detalhes".

### `/trip/:id/hospedagem`
Lista de estadias: nome, cidade, **check-in e check-out com hora**, localizador, valor, botão "Ver voucher".

### `/trip/:id/despesas`
Lista agrupada por dia com o valor grande à direita. Filtro por categoria e por pessoa. **Total da viagem no topo, em fonte grande, na moeda da viagem.**

**Lançar despesa em 3 toques:** teclado numérico gigante → grid de ícones de categoria → confirmar. Categorias: transporte, hospedagem, alimentação, mercado, atrações, compras, outros. Foto do comprovante atrás de um ícone de câmera grande, **sempre opcional**.

**Multimoeda:** se a moeda digitada for diferente de `trip.moeda_base`, buscar a cotação do dia automaticamente, preencher o campo, deixá-lo **editável**, e gravar como snapshot o que ficou. Se a viagem é em euro e o gasto é em euro, não perguntar nada.

### `/trip/:id/pessoas`
Lista de participantes. **Ao adicionar alguém que já existe, não abrir formulário:** mostrar um card com o que o app já sabe (nome, documento e validade, se houver) e um botão grande **"Está tudo certo"**. Só o que estiver faltando ou vencido pede toque.

### `/trip/:id/revisao` — O AUDITOR
Motor de regras **determinístico em TypeScript, funções puras, sem IA**. Roda a cada gravação e ao abrir a viagem. Reprodutível, explicável, funciona offline.

**Grupo A — buracos no tempo:**
- `A1` **Noite sem cama**: para cada noite entre a chegada e a partida, existe hospedagem cobrindo? → 🔴
- `A2` **Hotel termina antes do voo de volta**: `max(checkout) < partida do último bilhete de saída` → 🔴
- `A3` **Hotel começa depois da chegada**: `min(checkin) > chegada do primeiro bilhete` → 🔴
- `A4` **Hospedagem fora da janela da viagem** → 🟡
- `A5` **Dois hotéis na mesma noite** (intervalos sobrepostos) → 🟡

**Grupo D — datas implausíveis:**
- `D1` **Ano errado**: ano do item não bate com o ano da viagem → 🔴
- `D2` **Dia/mês trocados**: item fora da janela **E** dia ≤ 12 **E** trocando dia com mês ele cai dentro → 🔴
- `D3` **Duração de voo implausível**: menos de 30 min ou mais de 20 h → 🟡
- `D4` **Chega antes de sair** → 🔴
- `D5` **Item fora da janela da viagem** → 🟡

**Como o resultado aparece:** cada achado é um **cartão alto** com ícone grande da severidade à esquerda, **uma frase em linguagem de gente**, os **dois itens em conflito lado a lado como mini-cards** (isso é a evidência), um **botão grande de correção** ("Editar hotel") e um "Está certo" discreto.

**Três comportamentos que decidem se o módulo sobrevive:**
1. **Dispensar tem memória.** O achado guarda um hash dos campos que o geraram. Dispensado fica dispensado **até o hash mudar** — aí ele volta sozinho. Sem isso o auditor vira ruído e o usuário para de ler.
2. **Descrever, não julgar.** "O hotel termina dia 14 e seu voo é dia 15" — os dois fatos, sem adjetivo. Nunca "sua reserva está errada": o usuário pode ter razão.
3. **Nunca bloqueia.** Nenhum achado impede salvar. Se um salvamento acabou de criar um 🔴, mostrar um toast com o achado e o botão de correção — nunca um modal.

Zero achado = uma tela vazia bonita dizendo "Tudo conferido", não uma lista vazia.

---

## OFFLINE

PWA instalável com cache das viagens ativas. **O app tem que abrir no avião** e mostrar bilhetes, hospedagem e despesas já salvos. O auditor roda local. Teste em modo avião faz parte do aceite.

---

## O TESTE DE ACEITAÇÃO

Abrir no celular, com o braço esticado, no sol. Se não der para ler o número principal e acertar o botão principal de primeira, a tela volta.

---

Comece pelo design system e pelo banco, depois `/` e `/trip/:id`, depois bilhetes e hospedagem, depois despesas, e o auditor por último. Não peça confirmação a cada passo — construa a Entrega 1 inteira.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://evoqueviagens.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ed787434-5ecb-4cd1-86c6-bb105f4dda51).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
