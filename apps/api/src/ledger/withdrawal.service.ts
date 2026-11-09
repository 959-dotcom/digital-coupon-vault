import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { DomainError } from '../common/domain-error.js';
import { ZERO, formatMoney, moneyFromDatabase, parseExactMoney } from '../money/decimal.js';
import { buildWithdrawalLedger } from '../money/ledger.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WalletService } from '../redis/wallet.service.js';
import type { CreateWithdrawalDto } from './dto.js';

@Injectable()
export class WithdrawalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  async create(actor: AuthUser, dto: CreateWithdrawalDto) {
    const user = await this.prisma.user.findUnique({ where: { id: actor.userId } });
    if (!user || !user.isActive) {
      throw new DomainError('USER_INACTIVE');
    }
    const amount = parseExactMoney(dto.amount);
    if (amount.lte(0)) {
      throw new DomainError('INVALID_AMOUNT');
    }
    const destination = dto.destination.trim();
    if (destination.length === 0) {
      throw new DomainError('INVALID_ITEM');
    }
    const id = randomUUID();
    await this.wallet.reserve(actor.userId, amount, id);
    let committed = false;
    try {
      const created = await this.prisma.$transaction(
        async (tx) => {
          const available = await this.availablePoints(tx, actor.userId);
          if (amount.gt(available)) {
            throw new DomainError('INSUFFICIENT_BALANCE');
          }
          const lines = buildWithdrawalLedger({ userId: actor.userId, amount });
          await tx.ledgerEntry.createMany({
            data: lines.map((line) => ({
              transactionId: id,
              accountType: line.accountType,
              accountCode: line.accountCode,
              debit: formatMoney(line.debit),
              credit: formatMoney(line.credit),
              memo: line.memo,
            })),
          });
          return tx.withdrawal.create({
            data: {
              id,
              userId: actor.userId,
              amount: formatMoney(amount),
              destination,
              status: 'ACCEPTED',
            },
          });
        },
        { isolationLevel: 'Serializable' },
      );
      committed = true;
      await this.wallet.capture(id);
      return {
        id: created.id,
        amount: formatMoney(moneyFromDatabase(created.amount)),
        destination: created.destination,
        status: created.status,
        createdAt: created.createdAt.toISOString(),
      };
    } catch (error) {
      if (!committed) {
        await this.wallet.release(actor.userId, id);
      }
      throw error;
    }
  }

  async list(actor: AuthUser) {
    const rows = await this.prisma.withdrawal.findMany({
      where: { userId: actor.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((row) => ({
      id: row.id,
      amount: formatMoney(moneyFromDatabase(row.amount)),
      destination: row.destination,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async ledger(actor: AuthUser) {
    const accountCode = `USER_POINTS:${actor.userId}`;
    const rows = await this.prisma.ledgerEntry.findMany({
      where: { accountCode },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    let running = ZERO;
    const flow = rows.map((row) => {
      const debit = moneyFromDatabase(row.debit);
      const credit = moneyFromDatabase(row.credit);
      running = running.plus(credit).minus(debit);
      return {
        id: row.id,
        accountCode: row.accountCode,
        debit: formatMoney(debit),
        credit: formatMoney(credit),
        memo: row.memo,
        createdAt: row.createdAt.toISOString(),
        running: formatMoney(running),
      };
    });
    return flow.reverse();
  }

  private async availablePoints(tx: Prisma.TransactionClient, userId: string) {
    const rows = await tx.ledgerEntry.findMany({
      where: { accountCode: `USER_POINTS:${userId}` },
      select: { debit: true, credit: true },
    });
    let available = ZERO;
    for (const row of rows) {
      available = available.plus(moneyFromDatabase(row.credit)).minus(moneyFromDatabase(row.debit));
    }
    return available;
  }
}
