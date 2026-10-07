# Regras para trabalhar neste repositório

- Escreva sempre em português do Brasil (código, textos da tela, commits e explicações).
- Não mude o visual sem o Fausto pedir. Ao criar ou mudar telas: poucos cliques, pouco texto, ícones grandes, navegação intuitiva.
- Nunca grave chave, senha ou token no código nem no git. Segredos ficam no `.env.local` (local) e no Cloudflare (Secrets).
- Toda mudança numa branch nova; a `main` só recebe merge depois de testar a prévia.
- Não reescreva histórico já publicado (sem force push).
- O app precisa continuar funcionando sem internet (service worker em `public/sw.js`, pacote offline). Teste o modo avião em mudanças que mexam em carregamento ou cache.
- Leia também `AGENTS.md` (regras de dados e privacidade do app).
