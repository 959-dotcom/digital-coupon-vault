# Production

`docker compose --profile production` builds and starts the API, the web app, Redis, and the batch worker. Postgres is not in that profile. `DATABASE_URL` points at the external database.

Placeholders only. Do not commit `.env`.

## Vercel

Import this repository. Set:

```bash
NEXT_PUBLIC_API_URL=https://api.db357.com
CORS_ORIGIN=https://app.db357.com
APP_URL=https://app.db357.com
```

`NEXT_PUBLIC_API_URL` is the public API origin. The browser app is `https://app.db357.com`. The API reads `CORS_ORIGIN` for cross-origin requests. The Next.js server proxies `/api/bff` through `API_INTERNAL_URL`. On Vercel, set that to `https://api.db357.com`. Do not put `DATABASE_URL` or other secrets on the Vercel project.

หมายเหตุ: นำเข้า repo นี้ใน Vercel แล้วตั้ง `NEXT_PUBLIC_API_URL` เป็น `https://api.db357.com` แอปคือ `https://app.db357.com` อย่าใส่รหัสผ่านฐานข้อมูลหรือ secret อื่นใน Vercel

## Migrate

The running API uses the pooler URL (pgbouncer, port 6543) in `DATABASE_URL`. `prisma migrate deploy` needs the direct URL (port 5432). pgbouncer transaction mode does not keep the session Prisma uses for its advisory lock.

```bash
DATABASE_URL='postgresql://USER:PASSWORD@DIRECT_HOST:5432/DATABASE?schema=public' npm run prisma:migrate
```

Use the direct Supabase URL for this command only. The value above is a placeholder.

หมายเหตุ: รัน migrate กับ direct URL ของ Supabase (พอร์ต 5432) ห้ามใช้ URL ของ pgbouncer (พอร์ต 6543)

## VPS

Copy `.env.production.example` to `.env` on the host and fill the placeholders there. Migrate first, then:

```bash
docker compose --profile production up -d --build
```

That starts `api`, `web`, `redis`, and `worker`. It does not start Postgres. The production service commands do not run migrations, so the pooler URL is not used for `migrate deploy`. `deploy/nginx-api.conf.example` listens on 443 for `api.db357.com` and proxies to port 4000. Leave `ORACLE_SOURCE_URLS` empty unless a result source is configured.

หมายเหตุ: บน VPS คำสั่งนี้สร้าง backend, frontend, Redis และ batch worker Nginx ของ `api.db357.com` ส่งพอร์ต 443 ไปที่ 4000 ฐานข้อมูลอยู่นอก Compose ให้ `DATABASE_URL` ชี้ไปที่ Supabase
