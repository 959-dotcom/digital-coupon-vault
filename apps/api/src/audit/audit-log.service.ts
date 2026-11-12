import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { AuthUser } from '../auth/auth-user.js';
import { DomainError } from '../common/domain-error.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type AuditInput = {
  actorId: string | null;
  action:
    | 'LEDGER_ADJUSTMENT'
    | 'BATCH_SETTLEMENT'
    | 'ORACLE_SETTLEMENT'
    | 'WITHDRAWAL_DECISION'
    | 'COMMISSION_RATE_UPDATE'
    | 'ADMIN_LOGIN'
    | 'STAFF_LOGIN'
    | 'STAFF_CREATE'
    | 'STAFF_UPDATE'
    | 'HOLD_UPDATE'
    | 'SETTINGS_UPDATE'
    | 'CREDIT_MINT'
    | 'CREDIT_BURN'
    | 'CREDIT_TRANSFER'
    | 'PRODUCT_TOGGLE'
    | 'DOWNLINE_CREATE'
    | 'MODE_UPDATE';
  target: string;
  detail: Prisma.InputJsonValue;
  ip?: string | null;
};

type AuditWriter = PrismaService | Prisma.TransactionClient;

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async append(db: AuditWriter, input: AuditInput): Promise<void> {
    await db.adminAuditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        target: input.target,
        detail: input.detail,
        ip: input.ip ?? null,
      },
    });
  }

  async search(actor: AuthUser, query: string, pageInput: number) {
    if (actor.role !== 'SUPER_ADMIN') {
      throw new DomainError('FORBIDDEN');
    }
    const page = Number.isInteger(pageInput) && pageInput > 0 ? pageInput : 1;
    const pageSize = 20;
    const offset = (page - 1) * pageSize;
    const needle = query.trim().replace(/[%_\\]/g, '').slice(0, 80);
    const like = `%${needle}%`;
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; actorId: string | null; action: string; target: string; detail: unknown; createdAt: Date }>
    >`
      SELECT id, "actorId", action, target, detail, "createdAt"
      FROM "AdminAuditLog"
      WHERE ${needle.length === 0 ? Prisma.sql`TRUE` : Prisma.sql`(action ILIKE ${like} OR target ILIKE ${like} OR COALESCE("actorId", '') ILIKE ${like} OR detail::text ILIKE ${like})`}
      ORDER BY "createdAt" DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    const countRows = await this.prisma.$queryRaw<Array<{ count: string }>>`
      SELECT COUNT(*)::text AS count
      FROM "AdminAuditLog"
      WHERE ${needle.length === 0 ? Prisma.sql`TRUE` : Prisma.sql`(action ILIKE ${like} OR target ILIKE ${like} OR COALESCE("actorId", '') ILIKE ${like} OR detail::text ILIKE ${like})`}
    `;
    return {
      page,
      pageSize,
      total: Number(countRows[0]?.count ?? '0'),
      query: needle,
      rows: rows.map((row) => ({
        id: row.id,
        actorId: row.actorId,
        action: row.action,
        target: row.target,
        detail: row.detail,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }
}
