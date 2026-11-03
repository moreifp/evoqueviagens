# Evoque Viagens

App pessoal de organização de viagens (PWA, português do Brasil).

- **Stack:** TanStack Start + React 19 + Vite + Tailwind 4, banco no Supabase, publicado no Cloudflare Workers.
- **Endereço:** https://app.evoque.global (landing em https://evoque.global).
- **Saída do Lovable:** feita em outubro de 2026 (ver `docs/`).

## Rodar no computador

```bash
bun install
cp .env.example .env.local   # preencha os valores
bun run dev                  # http://localhost:8080
```

## Publicar

O Cloudflare publica sozinho a cada push: a branch `main` vai para produção e as outras branches ganham um endereço de prévia.

Variáveis e segredos: veja `docs/variaveis.md`. Templates de e-mail do login: `docs/templates-email/`.
