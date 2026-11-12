import { Injectable } from '@nestjs/common';
import { AccessService } from '../access/access.service.js';
import type { AuthUser } from '../auth/auth-user.js';
import { DomainError } from '../common/domain-error.js';
import { ZERO, formatMoney, moneyFromDatabase } from '../money/decimal.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RateLimitService } from '../redis/rate-limit.service.js';
import { readStoredItems } from './items.js';
import { VaultService } from '../vault/vault.service.js';
import type { CreateOrderDto } from './dto.js';
import { assertIdempotencyKey } from './dto.js';
import { IngestionService } from './ingestion.service.js';
import { CouponCategoryService } from './coupon-category.service.js';
import { ProductsService } from '../products/products.service.js';

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestion: IngestionService,
    private readonly rateLimit: RateLimitService,
    private readonly vault: VaultService,
    private readonly categories: CouponCategoryService,
    private readonly access: AccessService,
    private readonly products: ProductsService,
  ) {}

  listCategories() {
    return this.categories.list();
  }

  getCategory(id: string) {
    return this.categories.get(id);
  }

  async placeOrder(actor: AuthUser, dto: CreateOrderDto, idempotencyHeader: string | undefined) {
    await this.access.denyStaff(actor);
    if (!actor.partnerId) {
      throw new DomainError('NOT_ATTACHED');
    }
    const category = await this.prisma.couponCategory.findUnique({ where: { id: dto.categoryId } });
    if (!category || !category.isActive) {
      throw new DomainError('CATEGORY_INACTIVE');
    }
    await this.products.assertOpen(actor.userId, category.code);
    await this.rateLimit.hit(`order:${actor.userId}`, 20, 60);
    const idempotencyKey = assertIdempotencyKey(idempotencyHeader);
    return this.ingestion.enqueueAndWait({
      userId: actor.userId,
      partnerId: actor.partnerId,
      categoryId: dto.categoryId,
      batchId: dto.batchId,
      items: dto.items.map((item) => ({
        type: item.type,
        number: item.number,
        amount: item.amount,
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
    const gate = await this.access.principal(actor, 'balance');
    const accountCode = `USER_POINTS:${gate.line.userId}`;
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
}
