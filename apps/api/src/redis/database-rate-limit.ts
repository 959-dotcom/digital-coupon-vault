import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ThrottlerStorage, ThrottlerStorageRecord } from './throttler-storage.js';

type HitRow = { hits: number; ttl: number };

export class DatabaseThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly prisma: PrismaService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const rows = await this.prisma.$queryRaw<HitRow[]>(Prisma.sql`
      INSERT INTO "RateBucket" (bucket, hits, "resetAt")
      VALUES (${key}, 1, NOW() + (${ttl}::int * INTERVAL '1 millisecond'))
      ON CONFLICT (bucket) DO UPDATE SET
        hits = CASE WHEN "RateBucket"."resetAt" <= NOW() THEN 1 ELSE "RateBucket".hits + 1 END,
        "resetAt" = CASE
          WHEN "RateBucket"."resetAt" <= NOW() THEN NOW() + (${ttl}::int * INTERVAL '1 millisecond')
          ELSE "RateBucket"."resetAt"
        END
      RETURNING hits, GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("resetAt" - NOW()))))::int AS ttl
    `);
    const hits = Number(rows[0]?.hits ?? 1);
    const timeToExpire = Number(rows[0]?.ttl ?? Math.ceil(ttl / 1000));
    const blocked = hits > limit;
    return {
      totalHits: hits,
      timeToExpire,
      isBlocked: blocked,
      timeToBlockExpire: blocked ? Math.max(1, Math.ceil((blockDuration > 0 ? blockDuration : ttl) / 1000)) : 0,
    };
  }
}
