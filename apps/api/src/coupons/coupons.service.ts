import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { DomainError } from '../common/domain-error.js';
import { bangkokCalendarDate, cutoffInstant, formatCalendarDate, isPastCutoff } from '../cutoff/cutoff.js';
import { ZERO, formatMoney, moneyFromDatabase } from '../money/decimal.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RateLimitService } from '../redis/rate-limit.service.js';
import { readStoredItems } from './items.js';
import { VaultService } from '../vault/vault.service.js';
import type { CreateOrderDto } from './dto.js';
import { assertIdempotencyKey } from './dto.js';
import { IngestionService } from './ingestion.service.js';

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestion: IngestionService,
    private readonly rateLimit: RateLimitService,
    private readonly vault: VaultService,
  ) {}

  async listCategories() {
    const categories = await this.prisma.couponCategory.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
      include: { batches: { orderBy: { batchDate: 'asc' } } },
    });
    return categories.map((category) => this.presentCategory(category));
  }

  async getCategory(id: string) {
    const category = await this.prisma.couponCategory.findUnique({
      where: { id },
      include: { batches: { orderBy: { batchDate: 'asc' } } },
    });
    if (!category || !category.isActive) {
      throw new DomainError('CATEGORY_INACTIVE');
    }
    return this.presentCategory(category);
  }

  async placeOrder(actor: AuthUser, dto: CreateOrderDto, idempotencyHeader: string | undefined) {
    if (!actor.partnerId) {
      throw new DomainError('NOT_ATTACHED');
    }
    await this.rateLimit.hit(`order:${actor.userId}`, 20, 60);
    const idempotencyKey = assertIdempotencyKey(idempotencyHeader);
    return this.ingestion.enqueueAndWait({
      userId: actor.userId,
      partnerId: actor.partnerId,
      categoryId: dto.categoryId,
      batchId: dto.batchId,
      items: dto.items.map((item) => ({
        sku: item.sku,
        quantity: item.quantity,
        unitAmount: item.unitAmount,
      })),
      idempotencyKey,
    });
  }

  async myTransactions(actor: AuthUser) {
    const rows = await this.prisma.couponTx.findMany({
      where: { userId: actor.userId },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((row) => {
      const items = readStoredItems(row.items);
      const vaultValid = this.vault.verify(
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
        totalAmount: formatMoney(moneyFromDatabase(row.totalAmount)),
        txHash: row.txHash,
        items,
        createdAt: row.createdAt.toISOString(),
        confirmedAt: row.confirmedAt?.toISOString() ?? null,
        vaultValid,
        categoryCode: row.category.code,
        categoryName: row.category.name,
        batchId: row.batchId,
      };
    });
  }

  async myBalance(actor: AuthUser) {
    const accountCode = `USER_POINTS:${actor.userId}`;
    const rows = await this.prisma.ledgerEntry.findMany({
      where: { accountCode },
      select: { debit: true, credit: true },
    });
    let available = ZERO;
    for (const row of rows) {
      available = available.plus(moneyFromDatabase(row.credit)).minus(moneyFromDatabase(row.debit));
    }
    return { accountCode, available: formatMoney(available) };
  }

  private presentCategory(category: {
    id: string;
    code: string;
    name: string;
    description: string;
    cutoffTime: string;
    gridMin: number;
    gridMax: number;
    pad: number;
    stakeAmounts: unknown;
    batches: Array<{ id: string; batchDate: Date; label: string; isOpen: boolean }>;
  }) {
    const today = bangkokCalendarDate(new Date());
    const stakes = Array.isArray(category.stakeAmounts) ? category.stakeAmounts.map((value) => String(value)) : [];
    return {
      id: category.id,
      code: category.code,
      name: category.name,
      description: category.description,
      cutoffTime: category.cutoffTime,
      gridMin: category.gridMin,
      gridMax: category.gridMax,
      pad: category.pad,
      stakeAmounts: stakes,
      batches: category.batches
        .filter((batch) => batch.batchDate.getTime() >= today.getTime())
        .map((batch) => ({
          id: batch.id,
          batchDate: formatCalendarDate(batch.batchDate),
          label: batch.label,
          isOpen: batch.isOpen,
          pastCutoff: isPastCutoff(new Date(), batch.batchDate, category.cutoffTime),
          cutoffAt: cutoffInstant(batch.batchDate, category.cutoffTime).toISOString(),
        })),
    };
  }
}
