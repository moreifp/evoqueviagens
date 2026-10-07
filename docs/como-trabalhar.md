# Como trabalhar no Evoque Viagens (guia curto)

O app saiu do Lovable em 07/10/2026. Agora:

| Peça | Onde fica |
|---|---|
| Código | GitHub **moreifp/evoqueviagens** (branch atual: `saida-lovable`) |
| Banco, login e arquivos | Supabase, projeto `evoque-viagens` (São Paulo) |
| Site no ar | Cloudflare Workers, worker `evoque-viagens` → app.evoque.global |
| IA | API da Anthropic |
| Push, Maps, Drive e login Google | Google Cloud/Firebase `evoque-viagens-web` |

> O projeto no Lovable é só uma **cópia antiga**, parada. Ele usa o banco antigo e não está mais ligado ao GitHub. Nada feito lá chega ao app de verdade.

## 1. Preparar (uma vez)
1. Aceite o convite de colaborador no GitHub (o Fausto manda).
2. Instale o app Claude (aba **Code**) ou o Claude Code no terminal.
3. Clone o repositório: `git clone https://github.com/moreifp/evoqueviagens.git`
4. Peça ao Fausto o `.env.local`, pelo cofre do iCloud (nunca por WhatsApp ou e-mail). Ele traz só as chaves públicas (`VITE_*`) para rodar o app no seu computador.

## 2. Mudar algo
Abra a pasta no Claude e peça em português, por exemplo:

> "Na tela do hotel, mostre o horário de check-in maior. Faça numa branch nova."

O Claude segue as regras do `CLAUDE.md`: branch nova, sem mudar o visual sem pedir, sem chave no código, app funcionando offline.

Para ver no seu computador: `bun install` e depois `bun run dev`. O app abre em http://localhost:8080.

## 3. Publicar
1. Peça ao Claude: "suba a branch e abra um pull request".
2. Avise o Fausto. Quem publica no app.evoque.global é o Fausto, pelo Claude no Mac dele, com o script `publicar.py`, que tem as chaves do servidor.
3. Se algo der errado depois de publicar: Cloudflare → worker `evoque-viagens` → **Deployments** → versão anterior → **Rollback** (segundos).

## 4. Não fazer
- Não editar no Lovable achando que muda o app.
- Não religar o GitHub no Lovable: ele recoloca os pacotes dele e quebra a publicação no Cloudflare.
- Não colar chaves em chat, commit ou print.
- Não dar force push nem mexer direto na `main`.

## Onde procurar mais
- `docs/variaveis.md`: todas as variáveis e segredos, por nome.
- `CLAUDE.md` e `AGENTS.md`: regras do código e de privacidade.
- `docs/templates-email/`: e-mails do login.
