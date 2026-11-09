import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ThrottlerException } from '@nestjs/throttler';
import { config } from 'dotenv';
import { Redis } from 'ioredis';
import pg from 'pg';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter.js';
import { RedisThrottlerStorage, WITHDRAWAL_LIMIT, WITHDRAWAL_TTL_MS } from '../src/redis/throttler-storage.js';

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

test('an audit row cannot be changed', async () => {
  const migration = readFileSync(
    new URL('../prisma/migrations/20261109100000_audit_and_notifications/migration.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /BEFORE UPDATE OR DELETE ON "AdminAuditLog"/);
  assert.match(migration, /AUDIT_IMMUTABLE/);
  const service = readFileSync(new URL('../src/audit/audit-log.service.ts', import.meta.url), 'utf8');
  assert.equal(service.includes('adminAuditLog.update'), false);
  assert.equal(service.includes('adminAuditLog.delete'), false);

  const databaseUrl = process.env.DATABASE_URL;
  assert.equal(typeof databaseUrl, 'string');
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const id = randomUUID();
  try {
    await client.query(
      `INSERT INTO "AdminAuditLog" (id, action, target, detail) VALUES ($1, 'TEST_IMMUTABLE', 'audit-test', '{}'::jsonb)`,
      [id],
    );
    await assert.rejects(client.query(`UPDATE "AdminAuditLog" SET action = 'CHANGED' WHERE id = $1`, [id]), /AUDIT_IMMUTABLE/);
    await assert.rejects(client.query(`DELETE FROM "AdminAuditLog" WHERE id = $1`, [id]), /AUDIT_IMMUTABLE/);
  } finally {
    await client.end();
  }
});

test('a withdrawal over the limit returns 429', async () => {
  const redisUrl = process.env.REDIS_URL;
  assert.equal(typeof redisUrl, 'string');
  const redis = new Redis(redisUrl as string, { maxRetriesPerRequest: 1, enableReadyCheck: true });
  const storage = new RedisThrottlerStorage(redis);
  const key = `rl:test:withdraw:${randomUUID()}`;
  const captured: { statusCode: number; body: { message?: string } | null } = { statusCode: 0, body: null };
  try {
    for (let hit = 0; hit < WITHDRAWAL_LIMIT; hit += 1) {
      const record = await storage.increment(key, WITHDRAWAL_TTL_MS, WITHDRAWAL_LIMIT, 0, 'default');
      assert.equal(record.isBlocked, false);
    }
    const blocked = await storage.increment(key, WITHDRAWAL_TTL_MS, WITHDRAWAL_LIMIT, 0, 'default');
    assert.equal(blocked.isBlocked, true);
    assert.equal(blocked.totalHits, WITHDRAWAL_LIMIT + 1);
    new AllExceptionsFilter().catch(new ThrottlerException('RATE_LIMITED'), {
      switchToHttp: () => ({
        getResponse: () => ({
          status(code: number) {
            captured.statusCode = code;
            return this;
          },
          json(body: { message?: string }) {
            captured.body = body;
          },
        }),
      }),
    } as never);
    assert.equal(captured.statusCode, 429);
    assert.equal(captured.body?.message, 'RATE_LIMITED');
  } finally {
    await redis.del(key);
    await redis.quit();
  }
});
