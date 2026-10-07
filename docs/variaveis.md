# Variáveis e segredos do Evoque Viagens

## Build variables (Cloudflare → Worker → Settings → Build → Variables)
Entram no código do navegador na hora do build. Não são segredo.

| Nome | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `https://tqtizejwulbwtgdisemd.supabase.co` |
| `VITE_SUPABASE_PROJECT_ID` | `tqtizejwulbwtgdisemd` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | chave publishable do Supabase |
| `VITE_FIREBASE_API_KEY` | `apiKey` do app Web do Firebase (evoque-viagens-web) |
| `VITE_FIREBASE_PROJECT_ID` | `evoque-viagens-web` |
| `VITE_FIREBASE_APP_ID` | `appId` do app Web |
| `VITE_FIREBASE_VAPID_KEY` | chave do Web Push (Cloud Messaging) |
| `VITE_LOGO_DEV_TOKEN` | publishable token do Logo.dev (`pk_...`) |

## Secrets (Cloudflare → Worker → Settings → Variables and Secrets, tipo Secret)
Só o servidor enxerga.

| Nome | De onde vem |
|---|---|
| `SUPABASE_URL` | mesmo valor da `VITE_SUPABASE_URL` |
| `SUPABASE_PUBLISHABLE_KEY` | mesma chave publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | chave **secret** do Supabase (`sb_secret_...`) |
| `ANTHROPIC_API_KEY` | console.anthropic.com, chave `evoque-app` |
| `GOOGLE_MAPS_SERVER_KEY` | Google Cloud, chave de servidor (Places New, Time Zone, Geocoding) |
| `GOOGLE_DRIVE_CLIENT_ID` / `GOOGLE_DRIVE_CLIENT_SECRET` / `GOOGLE_DRIVE_REFRESH_TOKEN` | OAuth "Evoque Viagens · Drive" + OAuth Playground |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | conteúdo inteiro do JSON da conta de serviço do Firebase |
| `AERODATABOX_KEY` | RapidAPI (AeroDataBox) |
| `LINK_TOKEN_KEY` | valor aleatório forte (cifra o reenvio de convites) |
| `RESTAURANTS_SSO_SECRET` | mesmo valor configurado no Evoque Restaurants |
| `RESTAURANTS_CLIENT_ID` | o mesmo de hoje no Evoque Restaurants |
| `RESTAURANTS_URL` | `https://food.evoque.guru` (opcional) |

## Só no computador (`.env.local`, nunca no git)
`SUPABASE_DB_URL`: conexão do Session pooler, usada para restaurar o banco e rodar migrations.

## O que saiu (era do Lovable)
`LOVABLE_API_KEY`, `LOVABLE_SEND_URL`, `LOVABLE_CRON_SECRET`, `LOVABLE_DB_MIGRATION_URL`, `GOOGLE_DRIVE_API_KEY`, `GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_API_KEY_2`, `FIREBASE_MESSAGING_API_KEY`, `VITE_LOVABLE_CONNECTOR_*`.

## Agendamentos
Os jobs do pg_cron chamam `app_url + /api/public/hooks/...` com um token guardado no banco em `app_private.cron_config` (`k='status_voos'`). O `app_url` também fica nessa tabela. Não há segredo de cron no Cloudflare.
