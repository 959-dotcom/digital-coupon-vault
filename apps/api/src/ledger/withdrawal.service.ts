import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AuditLogService } from '../audit/audit-log.service.js';
import type { AuthUser } from '../auth/auth-user.js';
import { DomainError } from '../common/domain-error.js';
import { lockUserAndAssertBalance } from '../coupons/point-reservation.js';
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
    private readonly audit: AuditLogService,
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
    const available = await this.availablePoints(this.prisma, actor.userId);
    if (amount.gt(available)) {
      throw new DomainError('INSUFFICIENT_BALANCE');
    }
    const created = await this.prisma.withdrawal.create({
      data: {
        id: randomUUID(),
        userId: actor.userId,
        amount: formatMoney(amount),
        destination,
        status: 'PENDING',
      },
    });
    return this.present(created);
  }

  async approve(actor: AuthUser, id: string) {
    this.assertAdmin(actor);
    const existing = await this.prisma.withdrawal.findUnique({ where: { id } });
    if (!existing || existing.status !== 'PENDING') {
      throw new DomainError('CONFLICT');
    }
    const amount = moneyFromDatabase(existing.amount);
    const hold = randomUUID();
    await this.wallet.reserve(existing.userId, amount, hold);
    let committed = false;
    try {
      const updated = await this.prisma.$transaction(
        async (tx) => {
          await lockUserAndAssertBalance(tx, existing.userId, amount);
          const locked = await tx.$queryRaw<Array<{ id: string; status: string }>>`
            SELECT id, status FROM "Withdrawal" WHERE id = ${existing.id} FOR UPDATE
          `;
          if (locked.length !== 1 || locked[0]?.status !== 'PENDING') {
            throw new DomainError('CONFLICT');
          }
          const lines = buildWithdrawalLedger({ userId: existing.userId, amount });
          await tx.ledgerEntry.createMany({
            data: lines.map((line) => ({
              transactionId: existing.id,
              accountType: line.accountType,
              accountCode: line.accountCode,
              debit: formatMoney(line.debit),
              credit: formatMoney(line.credit),
              memo: line.memo,
            })),
          });
          const row = await tx.withdrawal.update({
            where: { id: existing.id },
            data: { status: 'APPROVED' },
          });
          await this.audit.append(tx, {
            actorId: actor.userId,
            action: 'WITHDRAWAL_DECISION',
            target: row.id,
            detail: { status: 'APPROVED', amount: formatMoney(amount) },
          });
          return row;
        },
        { isolationLevel: 'Serializable' },
      );
      committed = true;
      await this.wallet.capture(hold);
      return this.present(updated);
    } catch (error) {
      if (!committed) {
        await this.wallet.release(existing.userId, hold);
      }
      throw error;
    }
  }

  async reject(actor: AuthUser, id: string) {
    this.assertAdmin(actor);
    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string; status: string; amount: string }>>`
        SELECT id, status, amount::text AS amount FROM "Withdrawal" WHERE id = ${id} FOR UPDATE
      `;
      if (locked.length !== 1 || locked[0]?.status !== 'PENDING') {
        throw new DomainError('CONFLICT');
      }
      const row = await tx.withdrawal.update({
        where: { id },
        data: { status: 'REJECTED' },
      });
      await this.audit.append(tx, {
        actorId: actor.userId,
        action: 'WITHDRAWAL_DECISION',
        target: row.id,
        detail: { status: 'REJECTED', amount: formatMoney(moneyFromDatabase(locked[0].amount)) },
      });
      return row;
    });
    return this.present(updated);
  }

  async queue(actor: AuthUser) {
    this.assertAdmin(actor);
    const rows = await this.prisma.withdrawal.findMany({
      where: { status: 'PENDING' },
      include: { user: { select: { displayName: true, email: true } } },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    return rows.map((row) => ({
      ...this.present(row),
      member: row.user.displayName,
      email: row.user.email,
    }));
  }

  async list(actor: AuthUser) {
    const rows = await this.prisma.withdrawal.findMany({
      where: { userId: actor.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((row) => this.present(row));
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

  private present(row: { id: string; amount: { toString(): string } | string; destination: string; status: string; createdAt: Date }) {
    return {
      id: row.id,
      amount: formatMoney(moneyFromDatabase(row.amount)),
      destination: row.destination,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private assertAdmin(actor: AuthUser): void {
    if (actor.role !== 'SUPER_ADMIN') {
      throw new DomainError('FORBIDDEN');
    }
  }

  private async availablePoints(tx: Prisma.TransactionClient | PrismaService, userId: string) {
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
