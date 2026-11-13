import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { Redis } from 'ioredis';
import { DomainError } from '../src/common/domain-error.js';
import { assertCutoffOpen, lockUserAndAssertBalance } from '../src/coupons/point-reservation.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { Decimal, toMinorUnits } from '../src/money/decimal.js';
import { WalletService } from '../src/redis/wallet.service.js';
import { RedisService } from '../src/redis/redis.service.js';

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

test('concurrent reservations cannot overspend one balance', { timeout: 30_000 }, async () => {
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;
  assert.equal(typeof databaseUrl, 'string');
  assert.equal(typeof redisUrl, 'string');

  const past = new Date('2020-01-01T00:00:00.000Z');
  const future = new Date('2099-01-01T00:00:00.000Z');
  assert.throws(() => assertCutoffOpen(new Date(), past), (error: unknown) => {
    assert.ok(error instanceof DomainError);
    assert.equal(error.code, 'CUTOFF_PASSED');
    return true;
  });
  assert.doesNotThrow(() => assertCutoffOpen(new Date(), future));

  const redis = new Redis(redisUrl as string, { maxRetriesPerRequest: 1, enableReadyCheck: true });
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const userId = randomUUID();
  const walletKey = `wallet:points:${userId}`;
  const opening = new Decimal('10.0000');
  const slice = new Decimal('2.5000');
  const fundingId = randomUUID();
  const spendIds: string[] = [];
  try {
    await redis.set(walletKey, toMinorUnits(opening));
    const wallet = new WalletService({ client: redis } as RedisService, {} as never);
    const raced = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        wallet.reserve(userId, slice, `stress-${userId}-${index}`).then(
          () => true,
          () => false,
        ),
      ),
    );
    const reserved = raced.filter(Boolean).length;
    assert.equal(reserved, 4);
    assert.equal(await redis.get(walletKey), '0');
    assert.equal(await redis.exists(`wallet:lock:${userId}`), 0);

    await prisma.user.create({
      data: {
        id: userId,
        email: `stress-${userId}@vantage.test`,
        passwordHash: 'stress',
        displayName: 'stress',
        role: 'MEMBER',
      },
    });
    await prisma.ledgerEntry.createMany({
      data: [
        {
          transactionId: fundingId,
          accountType: 'ASSET',
          accountCode: 'PLATFORM_CASH',
          debit: '10.0000',
          credit: '0.0000',
          memo: 'FUND_CASH',
        },
        {
          transactionId: fundingId,
          accountType: 'LIABILITY',
          accountCode: `USER_CASH:${userId}`,
          debit: '0.0000',
          credit: '10.0000',
          memo: 'FUND_CASH',
        },
      ],
    });

    const closed = await prisma.$transaction(async (tx) => {
      assertCutoffOpen(new Date(), past);
      await lockUserAndAssertBalance(tx, userId, new Decimal('1.0000'));
      return true;
    }).then(
      () => true,
      (error: unknown) => error,
    );
    assert.ok(closed instanceof DomainError);
    assert.equal(closed.code, 'CUTOFF_PASSED');

    const spend = new Decimal('4.0000');
    const outcomes = await Promise.all(
      Array.from({ length: 8 }, () =>
        prisma
          .$transaction(async (tx) => {
            assertCutoffOpen(new Date(), future);
            await lockUserAndAssertBalance(tx, userId, spend);
            const transactionId = randomUUID();
            spendIds.push(transactionId);
            await tx.ledgerEntry.createMany({
              data: [
                {
                  transactionId,
                  accountType: 'LIABILITY',
                  accountCode: `USER_CASH:${userId}`,
                  debit: '4.0000',
                  credit: '0.0000',
                  memo: 'REDEEM_POINTS',
                },
                {
                  transactionId,
                  accountType: 'REVENUE',
                  accountCode: 'PLATFORM_SALES',
                  debit: '0.0000',
                  credit: '4.0000',
                  memo: 'COUPON_SALE',
                },
              ],
            });
          })
          .then(
            () => true,
            () => false,
          ),
      ),
    );
    const spent = outcomes.filter(Boolean).length;
    assert.equal(spent, 2);
    const rows = await prisma.ledgerEntry.findMany({
      where: { accountCode: `USER_CASH:${userId}` },
      select: { debit: true, credit: true },
    });
    let available = new Decimal(0);
    for (const row of rows) {
      available = available.plus(row.credit.toString()).minus(row.debit.toString());
    }
    assert.equal(available.toFixed(4), '2.0000');
    assert.ok(available.gte(0));
  } finally {
    const ids = [fundingId, ...spendIds];
    await prisma.ledgerEntry.deleteMany({ where: { transactionId: { in: ids } } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    const holdKeys = await redis.keys(`wallet:hold:stress-${userId}-*`);
    if (holdKeys.length > 0) {
      await redis.del(...holdKeys);
    }
    await redis.del(walletKey, `wallet:lock:${userId}`);
    await redis.quit();
    await prisma.$disconnect();
  }
});
