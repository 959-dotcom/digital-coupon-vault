# Vantage Desk

Enterprise digital coupon desk with a multi-tier affiliate ledger. The web UI is Thai. Code, API paths, enums, and the commands below are English.

## Prerequisites

- Node.js 20+
- Docker, for PostgreSQL 16 and Redis 7

## Configure

```bash
cp .env.example .env
```

Set `JWT_SECRET`, `SERVER_VAULT_SECRET`, and `HMAC_SECRET` to distinct values of at least 32 characters. Set `SEED_PASSWORD` before seeding. Do not commit `.env`.

The API and the Next.js server both read the repository-root `.env`. `HMAC_SECRET` stays on the server. The browser talks to `/api/bff`, which signs state-changing requests.

## Run

```bash
docker compose --profile local up -d
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev:api
npm run dev:web
```

- API: `http://127.0.0.1:4000`
- Web: `http://localhost:3000`

The `local` profile starts Postgres 16 (with `ltree`) and Redis. Production deploy is in `DEPLOY.md`.

Seed accounts (password is `SEED_PASSWORD`):

- `admin@vantage.local`
- `master@vantage.local`
- `shop@vantage.local`
- `member@vantage.local` (funded with 5000.0000 points)

## Checks

```bash
npm run prisma:validate
npm run typecheck
npm run test
```

`prisma validate` needs `DATABASE_URL` in the environment. It does not need a running database. The unit tests do not need Postgres or Redis.

## Clock

Order cutoff uses the API server clock in `Asia/Bangkok`. Production hosts should sync that clock with NTP. The request path does not call an external time server.

## Security notes

- `CouponTx` rows in `CONFIRMED` or `SETTLED` cannot be updated or deleted. The migration installs `trg_protect_vault_tx`. `PENDING` may move to `CONFIRMED` or `CANCELLED_SYSTEM`.
- `txHash` is SHA-256 over `id|userId|stable-json(items)|totalAmount|createdAt ISO|SERVER_VAULT_SECRET`.
- State-changing routes require `x-timestamp`, `x-nonce`, and `x-signature`. The signature is HMAC-SHA256 of `method|path|timestamp|nonce|rawBody`. Timestamps outside 60 seconds are rejected. Nonces are stored with Redis `SET NX`.
- Point balances are reserved with the Lua script in `apps/api/src/redis/scripts/reserve-balance.lua` (`DECRBY` on integer minor units). The ledger is double-entry and must balance before commit.
- Partner `path` is an `ltree` value computed by the server from the parent. Clients cannot set it.

Money math uses `decimal.js`. Amounts are decimal strings, not JavaScript numbers, except at the Redis integer boundary for minor units.
