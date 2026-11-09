FROM node:22-alpine AS deps
WORKDIR /repo
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
ENV DATABASE_URL=postgresql://coupon:coupon@postgres:5432/coupon?schema=public
RUN npm run prisma:generate -w @vantage/api && npm run build -w @vantage/api

FROM node:22-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build /repo/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/package-lock.json ./package-lock.json
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
