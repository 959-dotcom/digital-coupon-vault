import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { AuthUser } from '../auth/auth-user.js';
import { AccessService } from '../access/access.service.js';
import { DomainError } from '../common/domain-error.js';
import { moneyFromDatabase } from '../money/decimal.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { accountLevel, rollupReport, type BillBit, type ShareBit } from './report-rollup.js';
import { reportWindow, type ReportPreset } from './report-window.js';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async sales(actor: AuthUser, preset: ReportPreset, from?: string, to?: string) {
    const gate = await this.access.principal(actor, 'reports');
    const window = reportWindow(preset, new Date(), from, to);
    const viewer = await this.prisma.user.findUnique({ where: { id: gate.line.userId } });
    if (!viewer) {
      throw new DomainError('USER_INACTIVE');
    }
    const bills = await this.prisma.$queryRaw<
      Array<{ id: string; total: string; buyerId: string; buyerName: string; buyerPath: string }>
    >`
      SELECT t.id,
             t."totalAmount"::text AS total,
             buyer.id AS "buyerId",
             buyer."displayName" AS "buyerName",
             buyer.path::text AS "buyerPath"
      FROM "CouponTx" t
      JOIN "User" buyer ON buyer.id = t."userId"
      WHERE t.status IN ('CONFIRMED', 'SETTLED')
        AND t."createdAt" >= ${window.start}
        AND t."createdAt" < ${window.end}
        AND buyer.path <@ ${viewer.path}::ltree
        AND (${gate.reportScope}::text <> 'downline' OR buyer.id <> ${viewer.id})
    `;
    const ids = bills.map((bill) => bill.id);
    const shareRows = ids.length
      ? await this.prisma.$queryRaw<
          Array<{
            transactionId: string;
            userId: string;
            path: string;
            role: string;
            parentRole: string | null;
            amount: string;
            sentUpward: string;
          }>
        >`
          SELECT s."transactionId",
                 s."userId",
                 u.path::text AS path,
                 u.role::text AS role,
                 parent.role::text AS "parentRole",
                 s.amount::text AS amount,
                 s."sentUpward"::text AS "sentUpward"
          FROM "BillShare" s
          JOIN "User" u ON u.id = s."userId"
          LEFT JOIN "User" parent ON parent.id = u."parentId"
          WHERE s."transactionId" IN (${Prisma.join(ids)})
        `
      : [];
    const byBill = new Map<string, ShareBit[]>();
    for (const share of shareRows) {
      const list = byBill.get(share.transactionId) ?? [];
      list.push({
        userId: share.userId,
        path: share.path,
        level: accountLevel(share.role, share.parentRole),
        amount: moneyFromDatabase(share.amount),
        sentUpward: moneyFromDatabase(share.sentUpward),
      });
      byBill.set(share.transactionId, list);
    }
    const bits: BillBit[] = bills.map((bill) => ({
      buyerId: bill.buyerId,
      buyerName: bill.buyerName,
      buyerPath: bill.buyerPath,
      total: moneyFromDatabase(bill.total),
      shares: byBill.get(bill.id) ?? [],
    }));
    return {
      preset,
      start: window.start.toISOString(),
      end: window.end.toISOString(),
      rows: rollupReport(viewer.path, gate.reportScope, bits),
    };
  }
}
