import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { AccessService } from '../access/access.service.js';
import { AuditLogService } from '../audit/audit-log.service.js';
import type { AuthUser } from '../auth/auth-user.js';
import { DomainError } from '../common/domain-error.js';
import { Decimal, ZERO, formatMoney, moneyFromDatabase, parseExactMoney } from '../money/decimal.js';
import { buildFundingLedger } from '../money/ledger.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WalletService } from '../redis/wallet.service.js';
import type { FundPointsDto } from './dto.js';

type Scope =
  | { kind: 'all' }
  | { kind: 'user'; userId: string; accountCode: string }
  | { kind: 'tree'; path: string };

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly auditLog: AuditLogService,
    private readonly access: AccessService,
  ) {}

  async fund(actor: AuthUser, dto: FundPointsDto) {
    await this.access.denyStaff(actor);
    if (actor.role !== 'SUPER_ADMIN') {
      throw new DomainError('FORBIDDEN');
    }
    const amount = parseExactMoney(dto.amount);
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user || !user.isActive) {
      throw new DomainError('USER_INACTIVE');
    }
    const transactionId = randomUUID();
    const lines = buildFundingLedger({ userId: user.id, amount });
    await this.prisma.$transaction(async (tx) => {
      await tx.ledgerEntry.createMany({
        data: lines.map((line) => ({
          transactionId,
          accountType: line.accountType,
          accountCode: line.accountCode,
          debit: formatMoney(line.debit),
          credit: formatMoney(line.credit),
          memo: line.memo,
        })),
      });
      await this.auditLog.append(tx, {
        actorId: actor.userId,
        action: 'LEDGER_ADJUSTMENT',
        target: user.id,
        detail: { transactionId, amount: formatMoney(amount), memo: dto.memo.trim() },
      });
    });
    await this.wallet.credit(user.id, amount);
    return {
      transactionId,
      userId: user.id,
      amount: formatMoney(amount),
      memo: dto.memo.trim(),
    };
  }

  async audit(actor: AuthUser, pageInput: number, pageSizeInput: number) {
    const page = Number.isInteger(pageInput) && pageInput > 0 ? pageInput : 1;
    const pageSize = Number.isInteger(pageSizeInput) && pageSizeInput > 0 ? Math.min(pageSizeInput, 100) : 20;
    const scope = await this.scopeFor(actor);
    const filter = scopeFilter(scope);
    const offset = (page - 1) * pageSize;

    const idRows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT e."transactionId" AS id
      FROM "LedgerEntry" e
      LEFT JOIN "CouponTx" t ON t.id = e."transactionId"
      LEFT JOIN "Partner" p ON p.id = t."partnerId"
      WHERE ${filter}
      GROUP BY e."transactionId"
      ORDER BY MAX(e."createdAt") DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    const countRows = await this.prisma.$queryRaw<Array<{ count: string }>>`
      SELECT COUNT(*)::text AS count FROM (
        SELECT e."transactionId"
        FROM "LedgerEntry" e
        LEFT JOIN "CouponTx" t ON t.id = e."transactionId"
        LEFT JOIN "Partner" p ON p.id = t."partnerId"
        WHERE ${filter}
        GROUP BY e."transactionId"
      ) grouped
    `;
    const totalRows = await this.prisma.$queryRaw<Array<{ debit: string; credit: string }>>`
      SELECT COALESCE(SUM(e.debit), 0)::text AS debit, COALESCE(SUM(e.credit), 0)::text AS credit
      FROM "LedgerEntry" e
      WHERE e."transactionId" IN (
        SELECT e."transactionId"
        FROM "LedgerEntry" e
        LEFT JOIN "CouponTx" t ON t.id = e."transactionId"
        LEFT JOIN "Partner" p ON p.id = t."partnerId"
        WHERE ${scopeFilter(scope)}
      )
    `;

    const ids = idRows.map((row) => row.id);
    const entries = ids.length
      ? await this.prisma.ledgerEntry.findMany({
          where: { transactionId: { in: ids } },
          orderBy: { createdAt: 'asc' },
        })
      : [];
    const txs = ids.length
      ? await this.prisma.couponTx.findMany({
          where: { id: { in: ids } },
          select: { id: true, txHash: true, status: true, totalAmount: true },
        })
      : [];
    const txById = new Map(txs.map((tx) => [tx.id, tx]));

    const groups = ids.map((id) => {
      const lines = entries.filter((entry) => entry.transactionId === id);
      let debit = ZERO;
      let credit = ZERO;
      const presented = lines.map((line) => {
        const lineDebit = moneyFromDatabase(line.debit);
        const lineCredit = moneyFromDatabase(line.credit);
        debit = debit.plus(lineDebit);
        credit = credit.plus(lineCredit);
        return {
          id: line.id,
          accountType: line.accountType,
          accountCode: line.accountCode,
          debit: formatMoney(lineDebit),
          credit: formatMoney(lineCredit),
          memo: line.memo,
          createdAt: line.createdAt.toISOString(),
        };
      });
      const tx = txById.get(id);
      return {
        transactionId: id,
        txHash: tx?.txHash ?? null,
        status: tx?.status ?? null,
        totalAmount: tx ? formatMoney(moneyFromDatabase(tx.totalAmount)) : null,
        totalDebit: formatMoney(debit),
        totalCredit: formatMoney(credit),
        balanced: debit.eq(credit),
        entries: presented,
      };
    });

    const grandDebit = new Decimal(totalRows[0]?.debit ?? '0');
    const grandCredit = new Decimal(totalRows[0]?.credit ?? '0');
    return {
      page,
      pageSize,
      total: Number(countRows[0]?.count ?? '0'),
      grandDebit: formatMoney(grandDebit),
      grandCredit: formatMoney(grandCredit),
      balanced: grandDebit.eq(grandCredit),
      rows: groups,
    };
  }

  private async scopeFor(actor: AuthUser): Promise<Scope> {
    if (actor.role === 'SUPER_ADMIN') {
      return { kind: 'all' };
    }
    if (actor.role === 'MEMBER' || !actor.partnerId) {
      return { kind: 'user', userId: actor.userId, accountCode: `USER_POINTS:${actor.userId}` };
    }
    const partner = await this.prisma.partner.findUnique({ where: { id: actor.partnerId } });
    if (!partner) {
      throw new DomainError('NOT_ATTACHED');
    }
    return { kind: 'tree', path: partner.path };
  }
}

function scopeFilter(scope: Scope): Prisma.Sql {
  if (scope.kind === 'all') {
    return Prisma.sql`TRUE`;
  }
  if (scope.kind === 'user') {
    return Prisma.sql`(t."userId" = ${scope.userId} OR e."accountCode" = ${scope.accountCode})`;
  }
  return Prisma.sql`p.path <@ ${scope.path}::ltree`;
}
