import { Injectable } from '@nestjs/common';
import { AccessService } from '../access/access.service.js';
import type { AuthUser } from '../auth/auth-user.js';
import { DomainError } from '../common/domain-error.js';
import { formatMoney, moneyFromDatabase } from '../money/decimal.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isSameOrDescendant } from '../hierarchy/hold-waterfall.js';

export type BillListItem = {
  id: string;
  totalAmount: string;
  status: string;
  createdAt: string;
  buyerName: string;
  own: boolean;
};

export type BillSlice = {
  id: string;
  totalAmount: string;
  status: string;
  receivedFromBelow: string;
  ownHold: string;
  sentUpward: string;
};

@Injectable()
export class BillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async list(actor: AuthUser): Promise<BillListItem[]> {
    const gate = await this.access.principal(actor, 'reports');
    const viewer = await this.prisma.user.findUnique({ where: { id: gate.line.userId } });
    if (!viewer) {
      throw new DomainError('USER_INACTIVE');
    }
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; totalAmount: string; status: string; createdAt: Date; buyerName: string; buyerPath: string }>
    >`
      SELECT t.id,
             t."totalAmount"::text AS "totalAmount",
             t.status::text AS status,
             t."createdAt" AS "createdAt",
             buyer."displayName" AS "buyerName",
             buyer.path::text AS "buyerPath"
      FROM "CouponTx" t
      JOIN "User" buyer ON buyer.id = t."userId"
      WHERE t.status IN ('CONFIRMED', 'SETTLED')
        AND buyer.path <@ ${viewer.path}::ltree
        AND (${gate.reportScope}::text <> 'downline' OR buyer.id <> ${viewer.id})
      ORDER BY t."createdAt" DESC
      LIMIT 50
    `;
    return rows.map((row) => ({
      id: row.id,
      totalAmount: formatMoney(moneyFromDatabase(row.totalAmount)),
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      buyerName: row.buyerName,
      own: row.buyerPath === viewer.path,
    }));
  }

  async slice(actor: AuthUser, id: string): Promise<BillSlice> {
    const gate = await this.access.principal(actor, 'reports');
    const viewer = await this.prisma.user.findUnique({ where: { id: gate.line.userId } });
    if (!viewer) {
      throw new DomainError('USER_INACTIVE');
    }
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; totalAmount: string; status: string; buyerPath: string }>
    >`
      SELECT t.id, t."totalAmount"::text AS "totalAmount", t.status::text AS status, buyer.path::text AS "buyerPath"
      FROM "CouponTx" t
      JOIN "User" buyer ON buyer.id = t."userId"
      WHERE t.id = ${id}
        AND t.status IN ('CONFIRMED', 'SETTLED')
    `;
    const bill = rows[0];
    if (!bill || !isSameOrDescendant(viewer.path, bill.buyerPath)) {
      throw new DomainError('BILL_HIDDEN');
    }
    if (gate.reportScope === 'downline' && bill.buyerPath === viewer.path) {
      throw new DomainError('BILL_HIDDEN');
    }
    const share = await this.prisma.billShare.findUnique({
      where: { transactionId_userId: { transactionId: id, userId: gate.line.userId } },
    });
    return {
      id: bill.id,
      totalAmount: formatMoney(moneyFromDatabase(bill.totalAmount)),
      status: bill.status,
      receivedFromBelow: formatMoney(share ? moneyFromDatabase(share.receivedFromBelow) : 0),
      ownHold: formatMoney(share ? moneyFromDatabase(share.amount) : 0),
      sentUpward: formatMoney(share ? moneyFromDatabase(share.sentUpward) : 0),
    };
  }
}
