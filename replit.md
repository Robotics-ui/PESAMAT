# PesaMatrix

A cloud-to-cloud copy trading platform that lets subscribers copy expert MT5 trades automatically, with M-Pesa payments and MetaAPI/CopyFactory integration.

## Stack

- **Frontend**: React + Vite (TypeScript, Tailwind CSS, shadcn/ui, TanStack Query) — port 5000
- **Backend**: Express 5 API server (TypeScript, pino logging, JWT auth) — port 8080
- **Database**: PostgreSQL via Drizzle ORM (`@workspace/db`)
- **API contract**: OpenAPI spec → Orval codegen → `@workspace/api-client-react` + `@workspace/api-zod`
- **Monorepo**: pnpm workspaces (`artifacts/`, `lib/`)

## How to run

```
PORT=8080 pnpm --filter @workspace/api-server run dev & pnpm --filter @workspace/pesamatrix run dev
```

The "Start application" workflow runs this automatically. The frontend is served on port 5000 and the API on port 8080.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Auto-provided by Replit's managed PostgreSQL |
| `SESSION_SECRET` | Yes (prod) | JWT signing key — set as a Replit Secret |
| `METAAPI_TOKEN` | For trading | MetaApi cloud token; can also be set via Admin panel |
| `COPYFACTORY_WEBHOOK_SECRET` | For webhooks | CopyFactory webhook validation |
| `MPESA_CONSUMER_KEY` | For payments | Safaricom Daraja API |
| `MPESA_CONSUMER_SECRET` | For payments | Safaricom Daraja API |
| `MPESA_PASSKEY` | For payments | Safaricom Daraja API |
| `MPESA_SHORTCODE` | For payments | Safaricom Daraja paybill/till number |
| `MPESA_CALLBACK_URL` | For payments | Public URL for STK push callbacks |
| `MSPACE_API_KEY` | For SMS | Configurable in Admin > SMS panel |
| `MSPACE_USERNAME` | For SMS | Configurable in Admin > SMS panel |

## Default seeded accounts

On first startup the server seeds:
- **Admin**: `admin@pesamatrix.com` / `Admin@1234`
- **Demo trader**: available for testing

## Schema management

Push schema changes to the development database:
```
pnpm --filter @workspace/db push
```

Production schema is managed automatically by Replit's Publish flow.

## API codegen

Regenerate the frontend API client from the OpenAPI spec:
```
cd lib/api-spec && pnpm run generate
```

## User preferences

<!-- Add user-specific preferences here -->
