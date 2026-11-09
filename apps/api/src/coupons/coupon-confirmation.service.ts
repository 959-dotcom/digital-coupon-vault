import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { DomainError } from '../common/domain-error.js';
import { CommissionEngineService } from '../commission/commission-engine.service.js';
import { cutoffInstant } from '../cutoff/cutoff.js';
import { cutoffForSlot, parseSchedule } from './schedule.js';
import { formatMoney, formatRate, moneyFromDatabase } from '../money/decimal.js';
import { buildCouponLedger } from '../money/ledger.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WalletService } from '../redis/wallet.service.js';
import { VaultService } from '../vault/vault.service.js';
import { readStoredItems, canonicalizeItems } from './items.js';
import { assertCutoffOpen, lockUserAndAssertBalance } from './point-reservation.js';
import type { ConfirmOrderJob, OrderReceipt } from './dto.js';

@Injectable()
export class CouponConfirmationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly commission: CommissionEngineService,
    private readonly vault: VaultService,
  ) {}

  async confirm(job: ConfirmOrderJob): Promise<OrderReceipt> {
    const existing = await this.prisma.couponTx.findUnique({
      where: { idempotencyKey: job.idempotencyKey },
      include: { category: true },
    });
    if (existing && (existing.status === 'CONFIRMED' || existing.status === 'SETTLED')) {
      await this.wallet.capture(job.idempotencyKey);
      return this.receiptFromRow(existing, existing.category.code);
    }
    if (existing?.status === 'CANCELLED_SYSTEM') {
      throw new DomainError('ORDER_CANCELLED');
    }
    if (existing?.status === 'PENDING') {
      const lines = await this.prisma.ledgerEntry.count({ where: { transactionId: existing.id } });
      if (lines === 0) {
        await this.prisma.couponTx.update({
          where: { id: existing.id },
          data: { status: 'CANCELLED_SYSTEM' },
        });
        await this.wallet.release(job.userId, job.idempotencyKey);
        throw new DomainError('ORDER_CANCELLED');
      }
    }

    const prepared = await this.prepare(job);
    await this.wallet.reserve(job.userId, prepared.total, job.idempotencyKey);
    try {
      const receipt = await this.prisma.$transaction(
        async (tx) => {
          const again = await tx.couponTx.findUnique({ where: { idempotencyKey: job.idempotencyKey } });
          if (again && (again.status === 'CONFIRMED' || again.status === 'SETTLED')) {
            return this.receiptFromRow(again, prepared.category.code);
          }
          assertCutoffOpen(new Date(), prepared.cutoffAt);
          await lockUserAndAssertBalance(tx, job.userId, prepared.total);
          await this.assertStillOpen(tx, prepared.category.id, prepared.batch.id);

          const id = randomUUID();
          const createdAt = new Date();
          const txHash = this.vault.seal({
            id,
            userId: job.userId,
            items: prepared.items,
            totalAmount: prepared.total,
            createdAt,
          });
          await tx.couponTx.create({
            data: {
              id,
              userId: job.userId,
              partnerId: job.partnerId,
              categoryId: prepared.category.id,
              batchId: prepared.batch.id,
              items: prepared.items as unknown as Prisma.InputJsonValue,
              totalAmount: formatMoney(prepared.total),
              status: 'PENDING',
              txHash,
              idempotencyKey: job.idempotencyKey,
              createdAt,
            },
          });

          const allocation = await this.commission.calculate(job.partnerId, prepared.category.code, prepared.total);
          const ledger = buildCouponLedger({
            userId: job.userId,
            total: prepared.total,
            commissions: allocation.payable,
          });
          await tx.ledgerEntry.createMany({
            data: ledger.map((line) => ({
              transactionId: id,
              accountType: line.accountType,
              accountCode: line.accountCode,
              debit: formatMoney(line.debit),
              credit: formatMoney(line.credit),
              memo: line.memo,
            })),
          });
          if (allocation.payable.length > 0) {
            await tx.commissionRecord.createMany({
              data: allocation.payable.map((share) => ({
                transactionId: id,
                partnerId: share.partnerId,
                categoryCode: share.categoryCode,
                rate: formatRate(share.rate),
                baseAmount: formatMoney(share.baseAmount),
                amount: formatMoney(share.amount),
                mode: share.mode,
              })),
            });
          }
          const confirmed = await tx.couponTx.update({
            where: { id },
            data: { status: 'CONFIRMED', confirmedAt: new Date() },
          });
          const vaultValid = this.vault.verify(
            {
              id,
              userId: job.userId,
              items: prepared.items,
              totalAmount: prepared.total,
              createdAt,
            },
            txHash,
          );
          if (!vaultValid) {
            throw new DomainError('VAULT_MISMATCH');
          }
          return this.receiptFromRow(confirmed, prepared.category.code, true);
        },
        { isolationLevel: 'Serializable' },
      );
      await this.wallet.capture(job.idempotencyKey);
      return receipt;
    } catch (error) {
      const saved = await this.prisma.couponTx.findUnique({
        where: { idempotencyKey: job.idempotencyKey },
        include: { category: true },
      });
      if (saved && (saved.status === 'CONFIRMED' || saved.status === 'SETTLED')) {
        await this.wallet.capture(job.idempotencyKey);
        return this.receiptFromRow(saved, saved.category.code);
      }
      await this.wallet.release(job.userId, job.idempotencyKey);
      throw error;
    }
  }

  private async prepare(job: ConfirmOrderJob) {
    const user = await this.prisma.user.findUnique({ where: { id: job.userId } });
    if (!user || !user.isActive) {
      throw new DomainError('USER_INACTIVE');
    }
    if (!user.partnerId || user.partnerId !== job.partnerId) {
      throw new DomainError('NOT_ATTACHED');
    }
    const category = await this.prisma.couponCategory.findUnique({ where: { id: job.categoryId } });
    if (!category || !category.isActive) {
      throw new DomainError('CATEGORY_INACTIVE');
    }
    const batch = await this.prisma.couponBatch.findUnique({ where: { id: job.batchId } });
    if (!batch || !batch.isOpen || batch.settledAt || batch.categoryId !== category.id) {
      throw new DomainError('BATCH_CLOSED');
    }
    const cutoffAt = batchCutoff(category.schedule, category.cutoffTime, batch.batchDate, batch.slot);
    assertCutoffOpen(new Date(), cutoffAt);
    const canonical = canonicalizeItems(
      {
        pad: category.pad,
        stakeAmounts: category.stakeAmounts,
      },
      job.items,
    );
    return { user, category, batch, items: canonical.items, total: canonical.total, cutoffAt };
  }

  private async assertStillOpen(tx: Prisma.TransactionClient, categoryId: string, batchId: string): Promise<void> {
    const category = await tx.couponCategory.findUnique({ where: { id: categoryId } });
    const batch = await tx.couponBatch.findUnique({ where: { id: batchId } });
    if (!category || !category.isActive || !batch || !batch.isOpen || batch.settledAt || batch.categoryId !== category.id) {
      throw new DomainError('BATCH_CLOSED');
    }
    assertCutoffOpen(new Date(), batchCutoff(category.schedule, category.cutoffTime, batch.batchDate, batch.slot));
  }

  private receiptFromRow(
    row: {
      id: string;
      status: string;
      txHash: string;
      totalAmount: { toString(): string } | string;
      items: unknown;
      createdAt: Date;
      confirmedAt: Date | null;
      userId: string;
      categoryId: string;
      batchId: string;
    },
    categoryCode: string,
    vaultValid?: boolean,
  ): OrderReceipt {
    const items = readStoredItems(row.items);
    const valid =
      vaultValid ??
      this.vault.verify(
        {
          id: row.id,
          userId: row.userId,
          items,
          totalAmount: moneyFromDatabase(row.totalAmount),
          createdAt: row.createdAt,
        },
        row.txHash,
      );
    return {
      id: row.id,
      status: row.status,
      txHash: row.txHash,
      totalAmount: formatMoney(moneyFromDatabase(row.totalAmount)),
      items,
      createdAt: row.createdAt.toISOString(),
      confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
      vaultValid: valid,
      categoryCode,
      categoryId: row.categoryId,
      batchId: row.batchId,
    };
  }
}

function batchCutoff(schedule: unknown, fallback: string, batchDate: Date, slot: string): Date {
  const parsed = parseSchedule(schedule);
  return cutoffInstant(batchDate, cutoffForSlot(parsed, fallback, slot));
}
