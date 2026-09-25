# Evoque: cada pessoa é dona dos próprios dados

## Como vai funcionar (visão do usuário)

1. **Qualquer pessoa cria a própria conta** (e-mail e senha, Google ou Apple), sem precisar de aprovação. A lista de administradores deixa de existir.
2. **Primeiro acesso:** a pessoa preenche a própria ficha no app (Você, Passaporte, Vistos, Vacinas, Fidelidade, Preferências, Emergência), usando as mesmas telas de hoje, com leitura automática das fotos.
3. **Dependentes:** em "Minha família" a pessoa adiciona dependentes sem login (ex.: filha de 1 ano), com documentos, fidelidades e preferências. Quem cuida do dependente é o dono da conta.
4. **Viagens próprias:** cada conta cria viagens com hotéis, passagens, carros e reservas. Cada passagem ou reserva tem um nome de viajante, que pode ser o dono ou um dependente.
5. **Compartilhar, como no Instagram:**
   - O dono convida alguém (por e-mail ou WhatsApp) ou recebe um pedido de um organizador.
   - O dono escolhe **blocos** para compartilhar: Cadastro básico, Documentos, Fidelidade, Preferências, Emergência, Dependentes, Viagens (todas ou só as escolhidas).
   - O organizador **só vê**. Só o dono edita.
   - "Revogar" a qualquer momento: o acesso some na hora.
   - Tela "Compartilhamentos" com duas listas: "Compartilho com" e "Compartilham comigo", além dos pedidos pendentes (Aceitar / Recusar).
6. **Convite substitui o link pessoal:** o WhatsApp leva um link para criar a conta. Ao entrar, a pessoa vê "Fausto quer ver seus dados de viagem" e escolhe os blocos. O link antigo sem login é desativado; quem abrir verá "Crie sua conta para continuar".
7. **Fichas atuais viram pré-cadastros:** as fichas que já existem (Fausto, Diego, Gabriela, Luiza, Marcos…) continuam guardadas. Quando alguém cria a conta com o **mesmo e-mail** da ficha, a ficha passa a ser dela, já preenchida, e fica compartilhada com o Fausto (só leitura). A pessoa pode revogar. Fichas sem e-mail ficam como contato na conta do Fausto até alguém informar o e-mail.

## Etapas

1. **Contas abertas:** cadastro livre, fim da checagem de administrador, tela de entrada com "Criar conta" e "Entrar".
2. **Minha ficha e Minha família:** a ficha pertence à conta, e os dependentes ficam dentro dela.
3. **Compartilhamento por blocos:** convites, pedidos, aceitar, revogar e as telas de listas.
4. **Visão do organizador:** aba Pessoas mostra "Eu", minha família e quem compartilha comigo, só com os blocos liberados.
5. **Viagens por conta:** reservas e passagens ligadas ao viajante (dono ou dependente). Uma viagem compartilhada aparece para o organizador em modo leitura.
6. **Migração das fichas atuais** para pré-cadastros, que a pessoa assume ao entrar com o mesmo e-mail.
7. **Teste ponta a ponta com contas descartáveis** (criar conta, dependente, compartilhar, revogar, assumir pré-cadastro). Depois apagar tudo e publicar.

## Fica para depois (confirmar)

- Aluguel de carro e "outras reservas" como novos tipos de item da viagem (hoje existem passagens e hospedagem).
- Dependente que cresce e ganha login: passar a ficha para a conta dele.

## Detalhes técnicos

- `person`: adicionar `account_id` (dono), `kind` ('self' | 'dependent' | 'precadastro'), `email_claim` para o pré-cadastro. Cada conta tem uma única 'self'.
- Nova tabela `share_grant` (owner_id, grantee_id, person_id, blocos text[], trip_ids uuid[] | null, status pendente/ativo/revogado, criado/revogado_em) e `share_invite` (token_hash, email, blocos sugeridos, expira).
- Funções SECURITY DEFINER em `app_private`: `owns_person(pid)` e `can_view_block(pid, bloco)`. RLS: o dono tem ALL e quem recebeu o compartilhamento só SELECT, filtrado por bloco (documentos, fidelidade, preferências, emergência, viagens). Nenhuma escrita por quem recebeu.
- `trip`: o dono continua em `owner_id`. `ticket`/`lodging` ganham `traveler_person_id` (nullable). O SELECT do organizador passa por `share_grant`.
- Assumir o pré-cadastro: função no servidor que, após o login, liga a `person` 'precadastro' com o e-mail verificado igual ao da conta e cria um `share_grant` ativo para o criador original.
- Auth: `disable_signup=false`, mantendo `auto_confirm_email` (já ligado). Remover `verificarAdmin` do login social. `app_admin` fica marcado como descontinuado, sem ser apagado.
- `/c/:token` e `cadastro_link`: desativados (a rota mostra a tela de criar conta). Os links atuais deixam de abrir a ficha sem login.
- Fotos no bucket `documentos`: caminho por conta. As URLs assinadas saem de uma função no servidor que confere `can_view_block`.
- Rotas novas em `_authenticated/`: `/minha-ficha`, `/familia`, `/familia/:pid`, `/compartilhamentos`, `/convite/:token` (pública, leva ao cadastro).
