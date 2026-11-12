import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { AuthUser } from '../auth/auth-user.js';
import { DomainError } from '../common/domain-error.js';
import { Decimal, formatMoney, moneyFromDatabase, parseExactMoney } from '../money/decimal.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CreditService {
  constructor(private readonly prisma: PrismaService) {}

  async mint(actor: AuthUser, amountInput: string) {
    this.assertAdmin(actor);
    const amount = parseExactMoney(amountInput);
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, actor.userId);
      const before = await this.balance(tx, actor.userId);
      const after = before.plus(amount);
      await tx.creditAccount.update({ where: { userId: actor.userId }, data: { balance: formatMoney(after) } });
      const row = await tx.creditTransaction.create({
        data: {
          id: randomUUID(),
          kind: 'MINT',
          receiverId: actor.userId,
          amount: formatMoney(amount),
          receiverBefore: formatMoney(before),
          receiverAfter: formatMoney(after),
        },
      });
      return presentCredit(row);
    });
  }

  async burn(actor: AuthUser, amountInput: string) {
    this.assertAdmin(actor);
    const amount = parseExactMoney(amountInput);
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, actor.userId);
      const before = await this.balance(tx, actor.userId);
      if (before.lt(amount)) {
        throw new DomainError('INSUFFICIENT_BALANCE');
      }
      const after = before.minus(amount);
      await tx.creditAccount.update({ where: { userId: actor.userId }, data: { balance: formatMoney(after) } });
      const row = await tx.creditTransaction.create({
        data: {
          id: randomUUID(),
          kind: 'BURN',
          senderId: actor.userId,
          amount: formatMoney(amount),
          senderBefore: formatMoney(before),
          senderAfter: formatMoney(after),
        },
      });
      return presentCredit(row);
    });
  }

  async transfer(actor: AuthUser, receiverId: string, amountInput: string) {
    if (receiverId === actor.userId) {
      throw new DomainError('NOT_DIRECT_CHILD');
    }
    const amount = parseExactMoney(amountInput);
    const receiver = await this.prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver || !receiver.isActive || receiver.parentId !== actor.userId) {
      throw new DomainError('NOT_DIRECT_CHILD');
    }
    return this.prisma.$transaction(async (tx) => {
      const [first, second] = [actor.userId, receiverId].sort();
      await this.lock(tx, first);
      await this.lock(tx, second);
      const senderBefore = await this.balance(tx, actor.userId);
      if (senderBefore.lt(amount)) {
        throw new DomainError('INSUFFICIENT_BALANCE');
      }
      const receiverBefore = await this.balance(tx, receiverId);
      const senderAfter = senderBefore.minus(amount);
      const receiverAfter = receiverBefore.plus(amount);
      await tx.creditAccount.update({ where: { userId: actor.userId }, data: { balance: formatMoney(senderAfter) } });
      await tx.creditAccount.update({ where: { userId: receiverId }, data: { balance: formatMoney(receiverAfter) } });
      const row = await tx.creditTransaction.create({
        data: {
          id: randomUUID(),
          kind: 'TRANSFER',
          senderId: actor.userId,
          receiverId,
          amount: formatMoney(amount),
          senderBefore: formatMoney(senderBefore),
          senderAfter: formatMoney(senderAfter),
          receiverBefore: formatMoney(receiverBefore),
          receiverAfter: formatMoney(receiverAfter),
        },
      });
      return presentCredit(row);
    });
  }

  private assertAdmin(actor: AuthUser): void {
    if (actor.role !== 'SUPER_ADMIN') {
      throw new DomainError('FORBIDDEN');
    }
  }

  private async lock(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ userId: string }>>`
      SELECT "userId" FROM "CreditAccount" WHERE "userId" = ${userId} FOR UPDATE
    `;
    if (rows.length === 0) {
      throw new DomainError('NOT_ATTACHED');
    }
  }

  private async balance(tx: Prisma.TransactionClient, userId: string): Promise<Decimal> {
    const account = await tx.creditAccount.findUnique({ where: { userId } });
    if (!account) {
      throw new DomainError('NOT_ATTACHED');
    }
    return moneyFromDatabase(account.balance);
  }
}

function presentCredit(row: {
  id: string;
  kind: string;
  senderId: string | null;
  receiverId: string | null;
  amount: { toString(): string } | string;
  senderBefore: { toString(): string } | string | null;
  senderAfter: { toString(): string } | string | null;
  receiverBefore: { toString(): string } | string | null;
  receiverAfter: { toString(): string } | string | null;
}) {
  const money = (value: { toString(): string } | string | null) => (value === null ? null : formatMoney(moneyFromDatabase(value)));
  return {
    id: row.id,
    kind: row.kind,
    senderId: row.senderId,
    receiverId: row.receiverId,
    amount: formatMoney(moneyFromDatabase(row.amount)),
    beforeBalance: money(row.senderBefore ?? row.receiverBefore),
    afterBalance: money(row.senderAfter ?? row.receiverAfter),
    senderBefore: money(row.senderBefore),
    senderAfter: money(row.senderAfter),
    receiverBefore: money(row.receiverBefore),
    receiverAfter: money(row.receiverAfter),
  };
}
