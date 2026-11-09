import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { Redis } from 'ioredis';
import { CATEGORY_SEEDS, DEFAULT_STAKES } from '../src/coupons/category-catalog.js';
import { Prisma, PrismaClient } from '../src/generated/prisma/client.js';
import { nextSession } from '../src/coupons/schedule.js';
import { formatCalendarDate } from '../src/cutoff/cutoff.js';
import { formatMoney, parseExactMoney, toMinorUnits } from '../src/money/decimal.js';
import { buildFundingLedger } from '../src/money/ledger.js';

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(process.cwd(), '../../.env') });

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
const seedPassword = process.env.SEED_PASSWORD;
if (!databaseUrl || !redisUrl || !seedPassword || seedPassword.length < 8) {
  throw new Error('DATABASE_URL, REDIS_URL, and SEED_PASSWORD are required');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const redis = new Redis(redisUrl);

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(seedPassword as string, 12);
  const seeded = [];
  for (const category of CATEGORY_SEEDS) {
    const saved = await prisma.couponCategory.upsert({
      where: { code: category.code },
      update: {
        name: category.name,
        description: category.description,
        cutoffTime: category.cutoffTime,
        schedule: category.schedule as Prisma.InputJsonValue,
        isActive: true,
        gridMin: category.gridMin,
        gridMax: category.gridMax,
        pad: category.pad,
        stakeAmounts: [...DEFAULT_STAKES],
      },
      create: {
        code: category.code,
        name: category.name,
        description: category.description,
        cutoffTime: category.cutoffTime,
        schedule: category.schedule as Prisma.InputJsonValue,
        isActive: true,
        gridMin: category.gridMin,
        gridMax: category.gridMax,
        pad: category.pad,
        stakeAmounts: [...DEFAULT_STAKES],
      },
    });
    const next = nextSession(category.schedule, new Date());
    if (next) {
      await prisma.couponBatch.upsert({
        where: {
          categoryId_batchDate_slot: {
            categoryId: saved.id,
            batchDate: next.batchDate,
            slot: next.slot,
          },
        },
        update: {},
        create: {
          categoryId: saved.id,
          batchDate: next.batchDate,
          slot: next.slot,
          label: `งวด ${formatCalendarDate(next.batchDate)} ${next.slot}`,
          isOpen: true,
        },
      });
    }
    seeded.push(saved.code);
  }
  await prisma.couponCategory.updateMany({
    where: { code: { notIn: [...seeded] } },
    data: { isActive: false },
  });

  const ratesFor = (rate: string) => Object.fromEntries(CATEGORY_SEEDS.map((category) => [category.code, rate]));

  const house = await upsertPartner({
    code: 'house',
    name: 'สำนักใหญ่',
    parentId: null,
    path: 'house',
    distributionMode: 'COMMISSION_ONLY',
    commissionRates: ratesFor('0.0200'),
  });
  const branch = await upsertPartner({
    code: 'branch',
    name: 'สายกลาง',
    parentId: house.id,
    path: 'house.branch',
    distributionMode: 'FULL_PASS',
    commissionRates: ratesFor('0.0600'),
  });
  const shop = await upsertPartner({
    code: 'shop',
    name: 'ร้านสาขา',
    parentId: branch.id,
    path: 'house.branch.shop',
    distributionMode: 'SPLIT_KEEP',
    commissionRates: ratesFor('0.1000'),
  });

  await upsertUser({
    email: 'admin@vantage.local',
    displayName: 'ผู้ดูแลระบบ',
    role: 'SUPER_ADMIN',
    partnerId: null,
    passwordHash,
  });
  await upsertUser({
    email: 'master@vantage.local',
    displayName: 'พันธมิตรหลัก',
    role: 'MASTER_PARTNER',
    partnerId: house.id,
    passwordHash,
  });
  await upsertUser({
    email: 'shop@vantage.local',
    displayName: 'ร้านสาขา',
    role: 'PARTNER',
    partnerId: shop.id,
    passwordHash,
  });
  const member = await upsertUser({
    email: 'member@vantage.local',
    displayName: 'สมาชิกตัวอย่าง',
    role: 'MEMBER',
    partnerId: shop.id,
    passwordHash,
  });

  const accountCode = `USER_POINTS:${member.id}`;
  const existing = await prisma.ledgerEntry.findFirst({ where: { accountCode } });
  if (!existing) {
    const amount = parseExactMoney('5000.0000');
    const transactionId = crypto.randomUUID();
    const lines = buildFundingLedger({ userId: member.id, amount });
    await prisma.ledgerEntry.createMany({
      data: lines.map((line) => ({
        transactionId,
        accountType: line.accountType,
        accountCode: line.accountCode,
        debit: formatMoney(line.debit),
        credit: formatMoney(line.credit),
        memo: line.memo,
      })),
    });
    await redis.set(`wallet:points:${member.id}`, toMinorUnits(amount));
  }

  console.log(
    JSON.stringify(
      {
        categories: seeded,
        partners: [house.code, branch.code, shop.code],
        users: ['admin@vantage.local', 'master@vantage.local', 'shop@vantage.local', 'member@vantage.local'],
      },
      null,
      2,
    ),
  );
}

async function upsertPartner(input: {
  code: string;
  name: string;
  parentId: string | null;
  path: string;
  distributionMode: 'COMMISSION_ONLY' | 'FULL_PASS' | 'SPLIT_KEEP';
  commissionRates: Record<string, string>;
}) {
  return prisma.partner.upsert({
    where: { code: input.code },
    update: {
      name: input.name,
      parentId: input.parentId,
      path: input.path,
      distributionMode: input.distributionMode,
      commissionRates: input.commissionRates,
      isActive: true,
    },
    create: input,
  });
}

async function upsertUser(input: {
  email: string;
  displayName: string;
  role: 'SUPER_ADMIN' | 'MASTER_PARTNER' | 'PARTNER' | 'MEMBER';
  partnerId: string | null;
  passwordHash: string;
}) {
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      displayName: input.displayName,
      role: input.role,
      partnerId: input.partnerId,
      passwordHash: input.passwordHash,
      isActive: true,
    },
    create: input,
  });
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });
