# Production

The Next.js app and the Nest API both deploy on Vercel. Postgres stays on Supabase. Production does not use Docker, a VPS, or Nginx.

Do not commit `.env` or dashboard values.

## Supabase

Create a Supabase project. In the SQL editor enable `ltree` before migrating:

```sql
create extension if not exists ltree;
```

The running API uses the pooler URL (pgbouncer, transaction mode, port 6543) as `DATABASE_URL`, with `pgbouncer=true`. `prisma migrate deploy` needs the direct URL (session mode, port 5432). pgbouncer transaction mode does not keep the session Prisma uses for its advisory lock.

From a checkout, with dependencies installed:

```bash
DATABASE_URL='postgresql://USER:PASSWORD@DIRECT_HOST:5432/DATABASE?schema=public' npm run prisma:migrate
```

That value is a placeholder. Use the direct Supabase URL for this command only. Put the pooler URL in the API project's `DATABASE_URL` on Vercel.

สร้างโปรเจกต์ Supabase แล้วเปิดส่วนขยาย `ltree` ก่อน migrate URL พอร์ต 5432 ใช้กับคำสั่ง migrate เท่านั้น URL พอร์ต 6543 (pgbouncer) คือ `DATABASE_URL` ของแอปที่รันอยู่ อย่าใส่รหัสผ่านลงในไฟล์นี้

## Vercel web

Import this repository as one project.

| Setting | Value |
| --- | --- |
| Root Directory | `apps/web` |
| Framework Preset | Next.js |
| Production domain | `app.db357.com` |

Environment variables:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://api.db357.com` |
| `API_INTERNAL_URL` | `https://api.db357.com` |
| `APP_URL` | `https://app.db357.com` |
| `HMAC_SECRET` | same 32+ character value as the API project |

`apps/web/vercel.json` sets the Next.js framework and installs from the repository root. The browser calls `/api/bff`, and that route proxies to `API_INTERNAL_URL` (or `NEXT_PUBLIC_API_URL` when the internal URL is unset). Do not put `DATABASE_URL` on this project.

นำเข้า repo นี้เป็นโปรเจกต์เว็บ ตั้ง Root Directory เป็น `apps/web` โดเมนคือ `app.db357.com` ตั้ง `NEXT_PUBLIC_API_URL` เป็น `https://api.db357.com` อย่าใส่รหัสฐานข้อมูลในโปรเจกต์เว็บ

## Vercel API

Import the same repository as a second project.

| Setting | Value |
| --- | --- |
| Root Directory | `apps/api` |
| Framework Preset | Other |
| Production domain | `api.db357.com` |

`apps/api/vercel.json` installs the monorepo, runs `npm run vercel-build` (`prisma generate` and `nest build`), and serves `api/index.js`. That file boots the Nest app. `CORS_ORIGIN` is `https://app.db357.com`.

Environment variables:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Supabase pooler URL, port 6543, include `pgbouncer=true` |
| `JWT_SECRET` | 32+ random characters |
| `JWT_EXPIRES_IN` | `12h` |
| `SERVER_VAULT_SECRET` | 32+ random characters |
| `HMAC_SECRET` | same value as the web project |
| `CORS_ORIGIN` | `https://app.db357.com` |
| `APP_URL` | `https://app.db357.com` |
| `CRON_SECRET` | long random string |
| `ORACLE_SOURCE_URLS` | empty, unless a result source is configured |

Leave `REDIS_URL` unset. Rate limits and HMAC nonces use Postgres. Orders confirm in the request instead of BullMQ.

นำเข้า repo เดียวกันเป็นโปรเจกต์ API ตั้ง Root Directory เป็น `apps/api` โดเมนคือ `api.db357.com` ใส่ secret ในแดชบอร์ด Vercel เท่านั้น ไม่ต้องใช้ Redis

## Cron

`apps/api/vercel.json` schedules `GET /cron/batch` every minute. The route calls the Yeekee cutoff sync, the result oracle, and the notification reminder. Vercel sends `Authorization: Bearer <CRON_SECRET>`. A per-minute cron requires a Vercel plan that allows that schedule.

ถ้าไม่ตั้ง `ORACLE_SOURCE_URLS` งาน oracle จะไม่ดึงผลและบันทึกว่าไม่มีแหล่งข้อมูล Cron ทุกนาทีต้องใช้แผน Vercel ที่รองรับตารางนั้น
