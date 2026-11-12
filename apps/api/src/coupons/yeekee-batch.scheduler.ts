import { Injectable } from '@nestjs/common';
import { DomainError } from '../common/domain-error.js';
import { cutoffInstant, formatCalendarDate } from '../cutoff/cutoff.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CouponCategoryService } from './coupon-category.service.js';
import { cutoffForSlot, nextSession, parseSchedule } from './schedule.js';
import { drawYeekeeOutcome } from './yeekee-outcome.js';

@Injectable()
export class YeekeeBatchScheduler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CouponCategoryService,
  ) {}

  async sync(now: Date): Promise<void> {
    await this.syncYeekee(now, 'YEEKEE_15M', 'ยี่กี 15 นาที');
    await this.syncYeekee(now, 'YEEKEE_10M', 'ยี่กี 10 นาที');
  }

  private async syncYeekee(now: Date, code: string, labelPrefix: string): Promise<void> {
    const category = await this.prisma.couponCategory.findUnique({ where: { code } });
    if (!category || !category.isActive) {
      return;
    }
    const schedule = parseSchedule(category.schedule);
    const unsettled = await this.prisma.couponBatch.findMany({
      where: { categoryId: category.id, settledAt: null },
    });
    for (const batch of unsettled) {
      const cutoff = cutoffInstant(batch.batchDate, cutoffForSlot(schedule, category.cutoffTime, batch.slot));
      if (now.getTime() < cutoff.getTime()) {
        continue;
      }
      const draw = drawYeekeeOutcome();
      try {
        await this.categories.settleVerified({
          batchId: batch.id,
          top3: draw.top3,
          bottom2: draw.bottom2,
          actorId: null,
          action: 'BATCH_SETTLEMENT',
          outcomeExtra: { seedHash: draw.seedHash },
          detail: { source: code, seedHash: draw.seedHash },
        });
      } catch (error) {
        if (error instanceof DomainError && error.code === 'BATCH_SETTLED') {
          continue;
        }
        throw error;
      }
    }
    const next = nextSession(schedule, now);
    if (!next || schedule.intervalMinutes === null) {
      return;
    }
    const existing = await this.prisma.couponBatch.findUnique({
      where: {
        categoryId_batchDate_slot: {
          categoryId: category.id,
          batchDate: next.batchDate,
          slot: next.slot,
        },
      },
    });
    if (existing?.settledAt) {
      return;
    }
    const label = `${labelPrefix} งวด ${next.slot} ${formatCalendarDate(next.batchDate)}`;
    if (!existing) {
      await this.prisma.couponBatch.create({
        data: {
          categoryId: category.id,
          batchDate: next.batchDate,
          slot: next.slot,
          label,
          isOpen: true,
        },
      });
      return;
    }
    if (!existing.isOpen && now.getTime() < next.cutoffAt.getTime()) {
      await this.prisma.couponBatch.update({
        where: { id: existing.id },
        data: { isOpen: true },
      });
    }
  }
}
