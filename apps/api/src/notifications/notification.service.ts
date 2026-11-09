import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { AuthUser } from '../auth/auth-user.js';
import { DomainError } from '../common/domain-error.js';
import { cutoffInstant } from '../cutoff/cutoff.js';
import { formatMoney } from '../money/decimal.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { cutoffForSlot, parseSchedule } from '../coupons/schedule.js';

const REMINDER_WINDOW_MS = 5 * 60 * 1000;

type NotificationWriter = PrismaService | Prisma.TransactionClient;

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async remindUpcoming(now: Date): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    if (users.length === 0) {
      return;
    }
    const batches = await this.prisma.couponBatch.findMany({
      where: { isOpen: true, settledAt: null },
      include: { category: true },
    });
    const data: Prisma.NotificationCreateManyInput[] = [];
    for (const batch of batches) {
      let cutoff: Date;
      try {
        const schedule = parseSchedule(batch.category.schedule);
        cutoff = cutoffInstant(batch.batchDate, cutoffForSlot(schedule, batch.category.cutoffTime, batch.slot));
      } catch {
        continue;
      }
      const remaining = cutoff.getTime() - now.getTime();
      if (remaining <= 0 || remaining > REMINDER_WINDOW_MS) {
        continue;
      }
      for (const user of users) {
        data.push({
          userId: user.id,
          kind: 'CUTOFF_REMINDER',
          title: 'ใกล้ตัดยอด',
          body: `${batch.category.name} ${batch.label} จะปิดรับภายใน 5 นาที`,
          dedupeKey: `cutoff:${batch.id}:${user.id}`,
        });
      }
    }
    if (data.length === 0) {
      return;
    }
    await this.prisma.notification.createMany({ data, skipDuplicates: true });
  }

  async recordWins(
    tx: NotificationWriter,
    batchId: string,
    payouts: readonly { userId: string; amount: string }[],
  ): Promise<void> {
    const data = payouts
      .filter((payout) => payout.amount !== '0.0000')
      .map((payout) => ({
        userId: payout.userId,
        kind: 'SETTLEMENT_WIN',
        title: 'แต้มรางวัลเข้าแล้ว',
        body: `ได้รับ ${formatMoney(payout.amount)} แต้มจากงวดที่ปิดผลแล้ว`,
        dedupeKey: `win:${batchId}:${payout.userId}`,
      }));
    if (data.length === 0) {
      return;
    }
    await tx.notification.createMany({ data, skipDuplicates: true });
  }

  async list(actor: AuthUser) {
    const rows = await this.prisma.notification.findMany({
      where: { userId: actor.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const unread = await this.prisma.notification.count({
      where: { userId: actor.userId, readAt: null },
    });
    return {
      unread,
      rows: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        title: row.title,
        body: row.body,
        readAt: row.readAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async markRead(actor: AuthUser, id: string) {
    const row = await this.prisma.notification.findFirst({ where: { id, userId: actor.userId } });
    if (!row) {
      throw new DomainError('INVALID_ITEM');
    }
    if (row.readAt) {
      return { id: row.id, readAt: row.readAt.toISOString() };
    }
    const updated = await this.prisma.notification.update({
      where: { id: row.id },
      data: { readAt: new Date() },
    });
    return { id: updated.id, readAt: updated.readAt?.toISOString() ?? null };
  }

  async markAllRead(actor: AuthUser) {
    await this.prisma.notification.updateMany({
      where: { userId: actor.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { unread: 0 };
  }
}
