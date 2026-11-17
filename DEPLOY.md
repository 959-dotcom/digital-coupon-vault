# Production

The Next.js app and the Nest API both deploy on Vercel. Postgres stays on Supabase. Production does not use Docker, a VPS, or Nginx.

Do not commit `.env` or dashboard values.

## Hub schema

Coupon tables live in schema `coupon` on the Hub Supabase project `aozoakeghslgnhdegdyr` (`https://aozoakeghslgnhdegdyr.supabase.co`).

Paste `apps/api/prisma/hub/coupon_schema.sql` once in the Hub SQL editor:

https://supabase.com/dashboard/project/aozoakeghslgnhdegdyr/sql/new

That script creates schema `coupon` and the coupon tables. It leaves public hub tables and schema `dmck` unchanged. It does not insert accounts. The previous coupon database stays running.

After the paste succeeds, set this API project's `DATABASE_URL` to the Hub transaction-pooler URI: port `6543`, `pgbouncer=true`, `schema=coupon`, username `postgres.aozoakeghslgnhdegdyr`. Copy the host from the Hub Connect dialog. The API uses schema `coupon` when `DATABASE_URL` contains `aozoakeghslgnhdegdyr`. Until that variable changes, the API keeps using the previous database and schema `public`.

Leave schema `coupon` out of the Data API exposed schemas. The API connects with `DATABASE_URL` as the `postgres` role.

Do not put the database password in this file.

วางไฟล์ `apps/api/prisma/hub/coupon_schema.sql` ครั้งเดียวใน SQL editor ของ Hub โปรเจกต์ `aozoakeghslgnhdegdyr` หลังจากนั้นเปลี่ยน `DATABASE_URL` ของ API เป็น URI พูลเลอร์ของ Hub พอร์ต 6543 พร้อม `pgbouncer=true` และ `schema=coupon` แอปใช้สคีมา `coupon` เมื่อค่านี้มีรหัสโปรเจกต์นั้น ก่อนเปลี่ยนค่า แอปยังใช้ฐานข้อมูลเดิม

## Supabase

The local and previous databases still use schema `public`. In the SQL editor enable `ltree` before migrating those:

```sql
create extension if not exists ltree;
```

The running API uses the pooler URL (pgbouncer, transaction mode, port 6543) as `DATABASE_URL`, with `pgbouncer=true`. On the Hub project that URL also includes `schema=coupon`. `prisma migrate deploy` needs the direct URL (session mode, port 5432). pgbouncer transaction mode does not keep the session Prisma uses for its advisory lock. The Hub cutover uses the pasted SQL file above, so do not run `prisma migrate deploy` against the Hub project for this move.

From a checkout, with dependencies installed, against the previous database or local Postgres:

```bash
DATABASE_URL='postgresql://USER:PASSWORD@DIRECT_HOST:5432/DATABASE?schema=public' npm run prisma:migrate
```

That value is a placeholder. Use the direct URL for this command only. Put the Hub pooler URL (`schema=coupon`) in the API project's `DATABASE_URL` on Vercel after the SQL paste.

สำหรับ Hub ให้วาง SQL ในไฟล์ `apps/api/prisma/hub/coupon_schema.sql` อย่ารัน migrate กับโปรเจกต์ Hub สำหรับการย้ายนี้ URL พอร์ต 6543 (pgbouncer, `schema=coupon`) คือ `DATABASE_URL` ของแอปที่รันอยู่ อย่าใส่รหัสผ่านลงในไฟล์นี้

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
| `DATABASE_URL` | Hub pooler URL, port 6543, `pgbouncer=true`, `schema=coupon`, after the Hub SQL paste |
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

`apps/api/vercel.json` schedules `GET /cron/batch` once a day (`0 0 * * *`) so a Hobby project can deploy. The route calls the Yeekee cutoff sync, the result oracle, and the notification reminder. Vercel sends `Authorization: Bearer <CRON_SECRET>`. A per-minute schedule (`* * * * *`) requires a Vercel plan that allows it; switch the expression after upgrading.

ถ้าไม่ตั้ง `ORACLE_SOURCE_URLS` งาน oracle จะไม่ดึงผลและบันทึกว่าไม่มีแหล่งข้อมูล ตารางในไฟล์คือวันละครั้งเพราะบัญชี Hobby ยังรับ cron ทุกนาทีไม่ได้ หลังอัปเกรดแผนค่อยเปลี่ยนเป็น `* * * * *`
