import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { cutoffInstant, formatCalendarDate } from '../cutoff/cutoff.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { cutoffForSlot, nextSession, parseSchedule } from './schedule.js';

@Injectable()
export class YeekeeBatchScheduler implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('yeekee-batches') private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler('yeekee-15m', { pattern: '* * * * *' }, { name: 'sync', data: {} });
    await this.sync(new Date());
  }

  async sync(now: Date): Promise<void> {
    const category = await this.prisma.couponCategory.findUnique({ where: { code: 'YEEKEE_15M' } });
    if (!category || !category.isActive) {
      return;
    }
    const schedule = parseSchedule(category.schedule);
    const open = await this.prisma.couponBatch.findMany({
      where: { categoryId: category.id, isOpen: true, settledAt: null },
    });
    for (const batch of open) {
      const cutoff = cutoffInstant(batch.batchDate, cutoffForSlot(schedule, category.cutoffTime, batch.slot));
      if (now.getTime() >= cutoff.getTime()) {
        await this.prisma.couponBatch.update({
          where: { id: batch.id },
          data: { isOpen: false },
        });
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
    const label = `ยี่กี งวด ${next.slot} ${formatCalendarDate(next.batchDate)}`;
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
