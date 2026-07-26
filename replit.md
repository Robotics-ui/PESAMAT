# PesaMatrix

A cloud-to-cloud copy trading platform for MT5 accounts. Users subscribe via M-Pesa, link their MT5 account, and automatically copy trades from admin-approved signal providers.

## Stack

- **Frontend**: React + Vite (`artifacts/pesamatrix/`) — served on port 5000
- **API Server**: Express 5 + Node.js (`artifacts/api-server/`) — served on port 8080
- **Database**: PostgreSQL via Drizzle ORM (`lib/db/`)
- **Workspace libs**: `lib/api-spec`, `lib/api-zod`, `lib/api-client-react`
- **Package manager**: pnpm workspaces

## How to run

The "Start application" workflow runs both services:

```
PORT=8080 pnpm --filter @workspace/api-server run dev & PORT=5000 pnpm --filter @workspace/pesamatrix run dev
```

## External services needed

The following secrets must be configured for full functionality:

| Secret | Purpose |
|---|---|
| `SESSION_SECRET` | Express session signing |
| `DATABASE_URL` | PostgreSQL connection (auto-provisioned) |
| `METAAPI_TOKEN` | MetaApi cloud connection |
| `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` | M-Pesa STK push |
| `MPESA_SHORTCODE` / `MPESA_PASSKEY` | M-Pesa configuration |
| `MPESA_CALLBACK_URL` | M-Pesa payment callback |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Image uploads |
| `MSPACE_API_KEY` / `MSPACE_USERNAME` / `MSPACE_SENDER_ID` | SMS notifications |
| `COPYFACTORY_WEBHOOK_SECRET` | CopyFactory webhook verification |
| `APP_URL` / `ALLOWED_ORIGIN` | CORS and link generation |

## Setup notes

- After a fresh import, run `pnpm --filter @workspace/db run push` to apply the schema before starting the API.
- The API seeds default referral settings on startup.
- SMS remains disabled until `MSPACE_API_KEY` / `MSPACE_USERNAME` are configured via Admin > SMS settings.

## User preferences

- Keep existing monorepo structure (artifacts + lib)
- Use pnpm workspaces throughout
