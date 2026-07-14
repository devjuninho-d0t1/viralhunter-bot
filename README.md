# B2B Minerador — bot organizador de links

Bot que recebe links num grupo, organiza em pastas por comando e repassa
pra plataforma (integração do Felipe). **Telegram = ambiente de teste.
WhatsApp via Z-API = produção** — a arquitetura já está pronta, só
preencher chaves.

## Arquitetura

```
grupo (Telegram|WhatsApp)
        │ webhook
        ▼
app/api/telegram/route.ts   app/api/zapi/route.ts     ← transportes (finos)
        └──────────┬──────────────┘
                   ▼
        lib/commands.ts  handleMessage()               ← núcleo (canal-agnóstico)
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
  lib/store.ts          lib/platform.ts
  (Supabase:            (stub → plataforma do Felipe,
   folders, links)       PLATFORM_WEBHOOK_URL)
```

O núcleo não sabe de onde a mensagem veio. Migrar de canal = trocar o
webhook; zero mudança em comandos/pastas/links.

## Comandos (iguais nos dois canais)

| Mensagem | Efeito |
|---|---|
| `https://...` | salva na pasta **inbox** |
| `https://... #ads` | salva na pasta `ads` (cria se não existir) |
| `/pastas` | lista pastas com contagem |
| `/criar <nome>` | cria pasta |
| `/apagar <nome>` | apaga pasta e links (inbox é protegida) |
| `/renomear <antigo> > <novo>` | renomeia |
| `/links <pasta>` | lista links da pasta (30 últimos) |
| `/ajuda` | menu |

Mensagens sem link e sem comando são ignoradas em silêncio.

## Setup base (uma vez)

1. **Supabase** (free): criar projeto → SQL Editor → rodar `schema.sql`.
   Copiar `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (Settings → API).
2. Copiar `.env.example` → `.env.local` e preencher.
3. Deploy: `vercel --prod` + mesmas env vars na Vercel.

## Fase de teste — Telegram

1. @BotFather: `/newbot` → `TELEGRAM_BOT_TOKEN`; `/setprivacy` → **Disable**;
   adicionar o bot ao grupo de teste como admin.
2. `TELEGRAM_WEBHOOK_SECRET`: `openssl rand -hex 16`.
3. Apontar webhook:
   ```bash
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
     -d "url=https://<app>.vercel.app/api/telegram" \
     -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
   ```

## Migração pra WhatsApp (Z-API) — só preencher chaves

O adapter (`lib/zapi.ts` + `app/api/zapi/route.ts`) já implementa o shape
oficial do webhook (`type: ReceivedCallback`, `text.message`, `phone`,
`isGroup`/`participantPhone`, `fromMe`) e o envio via `send-text` com
header `Client-Token`. Passos:

1. **Chaves** — no painel da Z-API (instância deles):
   - `ZAPI_INSTANCE_ID` e `ZAPI_TOKEN`: estão na URL da API da instância
     (`api.z-api.io/instances/<ID>/token/<TOKEN>/...`).
   - `ZAPI_CLIENT_TOKEN`: painel → Segurança → Token de segurança da conta.
   - `ZAPI_WEBHOOK_SECRET`: gerar com `openssl rand -hex 16`.
   - `ZAPI_ALLOWED_CHATS` (recomendado): id do grupo do time
     (ex: `120363019502650977-group`) — o bot ignora qualquer outro chat.
     Pra descobrir o id: deixe vazio, mande uma mensagem no grupo e veja o
     `phone` no log da Vercel (`vercel logs`).
2. **Webhook** — painel da Z-API → Webhooks → "Ao receber" →
   `https://<app>.vercel.app/api/zapi?secret=<ZAPI_WEBHOOK_SECRET>`
   (marcar para notificar também mensagens de grupo, se houver a opção).
3. **Env vars na Vercel** → redeploy.
4. **Smoke test** — mandar no grupo: `/ajuda`, depois um link com `#pasta`.
5. **Desligar o Telegram** (opcional): `deleteWebhook` no bot de teste.
   Os dados (pastas/links) são os mesmos — o banco não muda.

## Integração com a plataforma (Felipe)

`lib/platform.ts` → `sendToPlatform({ url, folder, linkId })` é chamado a
cada link salvo. Hoje é no-op se `PLATFORM_WEBHOOK_URL` estiver vazio.
Quando a plataforma existir: implementar o POST real ali (e, se quiser,
marcar `links.sent_to_platform = true`). Nada mais muda.
