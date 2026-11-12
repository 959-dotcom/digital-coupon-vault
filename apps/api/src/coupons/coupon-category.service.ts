import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { AccessService } from '../access/access.service.js';
import { AuditLogService } from '../audit/audit-log.service.js';
import type { AuthUser } from '../auth/auth-user.js';
import { DomainError } from '../common/domain-error.js';
import { bangkokCalendarDate, cutoffInstant, formatCalendarDate } from '../cutoff/cutoff.js';
import { formatMoney, moneyFromDatabase, parseExactMoney } from '../money/decimal.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WalletService } from '../redis/wallet.service.js';
import type { SettleBatchDto } from './dto.js';
import { readStoredItems } from './items.js';
import { isSelectionType } from './selection.js';
import { buildPayoutLedger, payoutsByUser, type Outcome } from './payout.js';
import { countdownSeconds, cutoffForSlot, nextSession, parseSchedule, type Schedule } from './schedule.js';
import { NotificationService } from '../notifications/notification.service.js';

@Injectable()
export class CouponCategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly audit: AuditLogService,
    private readonly notifications: NotificationService,
    private readonly access: AccessService,
  ) {}

  async list() {
    const now = new Date();
    const categories = await this.prisma.couponCategory.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
      include: { batches: { orderBy: [{ batchDate: 'asc' }, { slot: 'asc' }] } },
    });
    const presented = [];
    for (const category of categories) {
      await this.ensureUpcoming(category, now);
      presented.push(this.presentLoaded(category, now));
    }
    return presented;
  }

  async get(id: string) {
    const now = new Date();
    const category = await this.prisma.couponCategory.findUnique({ where: { id } });
    if (!category || !category.isActive) {
      throw new DomainError('CATEGORY_INACTIVE');
    }
    await this.ensureUpcoming(category, now);
    return this.present(category.id, now);
  }

  async settle(actor: AuthUser, dto: SettleBatchDto) {
    await this.access.denyStaff(actor);
    return this.settleVerified({
      batchId: dto.batchId,
      top3: dto.top3,
      bottom2: dto.bottom2,
      actorId: actor.userId,
      action: 'BATCH_SETTLEMENT',
    });
  }

  async settleVerified(input: {
    batchId: string;
    top3: string;
    bottom2: string;
    actorId: string | null;
    action: 'BATCH_SETTLEMENT' | 'ORACLE_SETTLEMENT';
    outcomeExtra?: Record<string, string>;
    detail?: Record<string, string | number | boolean | null>;
  }) {
    const outcome: Outcome = { top3: input.top3, bottom2: input.bottom2 };
    const payoutRows = await this.prisma.$transaction(
      async (tx) => {
        const batch = await tx.couponBatch.findUnique({
          where: { id: input.batchId },
          include: { category: true },
        });
        if (!batch) {
          throw new DomainError('BATCH_NOT_FOUND');
        }
        if (batch.settledAt) {
          throw new DomainError('BATCH_SETTLED');
        }
        const confirmed = await tx.couponTx.findMany({
          where: { batchId: batch.id, status: 'CONFIRMED' },
        });
        const bets = confirmed.flatMap((row) =>
          readStoredItems(row.items).flatMap((item) => {
            if (!isSelectionType(item.type)) {
              return [];
            }
            return [
              {
                userId: row.userId,
                bet: {
                  type: item.type,
                  number: item.number,
                  amount: parseExactMoney(item.amount),
                },
              },
            ];
          }),
        );
        const payouts = payoutsByUser(bets, outcome);
        const lines = buildPayoutLedger(payouts);
        if (lines.length > 0) {
          await tx.ledgerEntry.createMany({
            data: lines.map((line) => ({
              transactionId: batch.id,
              accountType: line.accountType,
              accountCode: line.accountCode,
              debit: formatMoney(line.debit),
              credit: formatMoney(line.credit),
              memo: line.memo,
            })),
          });
        }
        const stored = { ...outcome, ...(input.outcomeExtra ?? {}) };
        await tx.couponBatch.update({
          where: { id: batch.id },
          data: {
            isOpen: false,
            settledAt: new Date(),
            outcome: stored as Prisma.InputJsonValue,
          },
        });
        const credited = payouts.map((payout) => ({ userId: payout.userId, amount: formatMoney(payout.amount) }));
        await this.notifications.recordWins(tx, batch.id, credited);
        await this.audit.append(tx, {
          actorId: input.actorId,
          action: input.action,
          target: batch.id,
          detail: {
            top3: outcome.top3,
            bottom2: outcome.bottom2,
            payouts: credited.length,
            ...(input.detail ?? {}),
          },
        });
        return credited;
      },
      { isolationLevel: 'Serializable' },
    );
    for (const payout of payoutRows) {
      await this.wallet.credit(payout.userId, moneyFromDatabase(payout.amount));
    }
    return {
      batchId: input.batchId,
      settled: true,
      outcome,
      payouts: payoutRows,
    };
  }

  private async ensureUpcoming(
    category: {
      id: string;
      code: string;
      schedule: unknown;
      cutoffTime: string;
      batches?: Array<{ batchDate: Date; slot: string }>;
    },
    now: Date,
  ): Promise<void> {
    const schedule = parseSchedule(category.schedule);
    if (schedule.intervalMinutes !== null) {
      return;
    }
    const next = nextSession(schedule, now);
    if (!next) {
      return;
    }
    const nextDate = formatCalendarDate(next.batchDate);
    const already = category.batches?.some(
      (batch) => batch.slot === next.slot && formatCalendarDate(batch.batchDate) === nextDate,
    );
    if (already) {
      return;
    }
    const label = `งวด ${nextDate} ${next.slot}`;
    await this.prisma.couponBatch.upsert({
      where: {
        categoryId_batchDate_slot: {
          categoryId: category.id,
          batchDate: next.batchDate,
          slot: next.slot,
        },
      },
      update: {},
      create: {
        categoryId: category.id,
        batchDate: next.batchDate,
        slot: next.slot,
        label,
        isOpen: true,
      },
    });
  }

  private async present(id: string, now: Date) {
    const category = await this.prisma.couponCategory.findUniqueOrThrow({
      where: { id },
      include: { batches: { orderBy: [{ batchDate: 'asc' }, { slot: 'asc' }] } },
    });
    return this.presentLoaded(category, now);
  }

  private presentLoaded(
    category: {
      id: string;
      code: string;
      name: string;
      description: string;
      cutoffTime: string;
      schedule: unknown;
      gridMin: number;
      gridMax: number;
      pad: number;
      stakeAmounts: Prisma.JsonValue;
      batches: Array<{
        id: string;
        batchDate: Date;
        slot: string;
        label: string;
        isOpen: boolean;
        settledAt: Date | null;
      }>;
    },
    now: Date,
  ) {
    const schedule = parseSchedule(category.schedule);
    const today = bangkokCalendarDate(now);
    const upcoming = nextSession(schedule, now);
    const stakes = Array.isArray(category.stakeAmounts) ? category.stakeAmounts.map((value) => String(value)) : [];
    return {
      id: category.id,
      code: category.code,
      name: category.name,
      description: category.description,
      cutoffTime: category.cutoffTime,
      group: schedule.group,
      schedule,
      gridMin: category.gridMin,
      gridMax: category.gridMax,
      pad: category.pad,
      stakeAmounts: stakes,
      countdownSeconds: upcoming ? countdownSeconds(upcoming.cutoffAt, now) : 0,
      nextCutoffAt: upcoming ? upcoming.cutoffAt.toISOString() : null,
      batches: category.batches
        .filter((batch) => batch.batchDate.getTime() >= today.getTime())
        .map((batch) => {
          const cutoff = cutoffInstant(batch.batchDate, cutoffForSlot(schedule, category.cutoffTime, batch.slot));
          return {
            id: batch.id,
            batchDate: formatCalendarDate(batch.batchDate),
            slot: batch.slot,
            label: batch.label,
            isOpen: batch.isOpen && !batch.settledAt,
            settled: batch.settledAt !== null,
            pastCutoff: now.getTime() > cutoff.getTime(),
            cutoffAt: cutoff.toISOString(),
          };
        }),
    };
  }
}

export type PresentedSchedule = Schedule;
