import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { Redis } from 'ioredis';
import type { AuditLogService } from '../src/audit/audit-log.service.js';
import type { AuthUser } from '../src/auth/auth-user.js';
import { DomainError } from '../src/common/domain-error.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { WithdrawalService } from '../src/ledger/withdrawal.service.js';
import { Decimal } from '../src/money/decimal.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { RedisService } from '../src/redis/redis.service.js';
import { WalletService } from '../src/redis/wallet.service.js';

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

test('an approve moves the point balance once', { timeout: 30_000 }, async () => {
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;
  assert.equal(typeof databaseUrl, 'string');
  assert.equal(typeof redisUrl, 'string');

  const redis = new Redis(redisUrl as string, { maxRetriesPerRequest: 1, enableReadyCheck: true });
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const userId = randomUUID();
  const fundingId = randomUUID();
  const walletKey = `wallet:points:${userId}`;
  const member: AuthUser = {
    userId,
    email: `approve-${userId}@vantage.test`,
    role: 'MEMBER',
    partnerId: null,
  };
  const admin: AuthUser = {
    userId: randomUUID(),
    email: 'admin@vantage.test',
    role: 'SUPER_ADMIN',
    partnerId: null,
  };
  const audit = { append: async () => undefined } as unknown as AuditLogService;
  const wallet = new WalletService({ client: redis } as RedisService, prisma as unknown as PrismaService);
  const service = new WithdrawalService(prisma as unknown as PrismaService, wallet, audit);
  const withdrawalIds: string[] = [];
  try {
    await prisma.user.create({
      data: {
        id: userId,
        email: member.email,
        passwordHash: 'approve-test',
        displayName: 'approve-test',
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
          accountCode: `USER_POINTS:${userId}`,
          debit: '0.0000',
          credit: '10.0000',
          memo: 'FUND_POINTS',
        },
      ],
    });

    const pending = await service.create(member, { amount: '4.0000', destination: 'promptpay' });
    withdrawalIds.push(pending.id);
    assert.equal(pending.status, 'PENDING');
    assert.equal(await pointBalance(prisma, userId), '10.0000');

    const approved = await service.approve(admin, pending.id);
    assert.equal(approved.status, 'APPROVED');
    assert.equal(await pointBalance(prisma, userId), '6.0000');
    await assert.rejects(() => service.approve(admin, pending.id), (error: unknown) => {
      assert.ok(error instanceof DomainError);
      assert.equal(error.code, 'CONFLICT');
      return true;
    });
    assert.equal(await pointBalance(prisma, userId), '6.0000');
    assert.equal(await prisma.ledgerEntry.count({ where: { transactionId: pending.id, memo: 'WITHDRAW_POINTS' } }), 1);
    assert.equal(await prisma.ledgerEntry.count({ where: { transactionId: pending.id, memo: 'WITHDRAW_CASH' } }), 1);

    const second = await service.create(member, { amount: '1.0000', destination: 'bank' });
    withdrawalIds.push(second.id);
    const rejected = await service.reject(admin, second.id);
    assert.equal(rejected.status, 'REJECTED');
    assert.equal(await pointBalance(prisma, userId), '6.0000');
    assert.equal(await prisma.ledgerEntry.count({ where: { transactionId: second.id } }), 0);

    const source = readFileSync(new URL('../src/ledger/withdrawal.service.ts', import.meta.url), 'utf8');
    assert.match(source, /FOR UPDATE/);
    assert.equal(source.includes('couponTx'), false);
  } finally {
    await prisma.ledgerEntry.deleteMany({ where: { transactionId: { in: [fundingId, ...withdrawalIds] } } });
    await prisma.withdrawal.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await redis.del(walletKey, `wallet:lock:${userId}`);
    await redis.quit();
    await prisma.$disconnect();
  }
});

async function pointBalance(prisma: PrismaClient, userId: string): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ debit: string; credit: string }>>`
    SELECT COALESCE(SUM(debit), 0)::text AS debit, COALESCE(SUM(credit), 0)::text AS credit
    FROM "LedgerEntry"
    WHERE "accountCode" = ${`USER_POINTS:${userId}`}
  `;
  const debit = rows[0]?.debit ?? '0';
  const credit = rows[0]?.credit ?? '0';
  return new Decimal(credit).minus(debit).toFixed(4);
}
