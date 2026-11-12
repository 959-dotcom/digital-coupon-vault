import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { AccessService } from '../access/access.service.js';
import { AuditLogService } from '../audit/audit-log.service.js';
import { DomainError } from '../common/domain-error.js';
import type { AuthUser } from '../auth/auth-user.js';
import { cutoffInstant } from '../cutoff/cutoff.js';
import { Decimal, ZERO, formatMoney, moneyFromDatabase } from '../money/decimal.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { childPath, normalizeCommissionRates, readCommissionRates } from './rates.js';
import type { CreatePartnerDto, UpdateCommercialDto, UpdatePartnerDto } from './dto.js';

export type PartnerView = {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  path: string;
  distributionMode: string;
  commissionRates: Record<string, string>;
  isActive: boolean;
};

export type PartnerTreeNode = PartnerView & { children: PartnerTreeNode[] };

export type OrgChartNode = PartnerView & {
  childPartnerCount: number;
  activeMemberCount: number;
  pointsFlow: string;
  children: OrgChartNode[];
};

export type CommissionReport = {
  from: string;
  to: string;
  total: string;
  byDay: Array<{ date: string; amount: string }>;
  byBatch: Array<{ batchId: string; label: string; categoryName: string; amount: string }>;
};

type PartnerRow = {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  path: string;
  distributionMode: string;
  commissionRates: unknown;
  isActive: boolean;
};

@Injectable()
export class PartnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly access: AccessService,
  ) {}

  async orgChart(actor: AuthUser): Promise<OrgChartNode[]> {
    const partners = await this.visiblePartners(actor);
    const ids = partners.map((partner) => partner.id);
    const members = new Map<string, number>();
    const points = new Map<string, Decimal>();
    if (ids.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { role: 'MEMBER', isActive: true, partnerId: { in: ids } },
        select: { partnerId: true },
      });
      for (const user of users) {
        if (!user.partnerId) {
          continue;
        }
        members.set(user.partnerId, (members.get(user.partnerId) ?? 0) + 1);
      }
      const sales = await this.prisma.couponTx.findMany({
        where: { partnerId: { in: ids }, status: { in: ['CONFIRMED', 'SETTLED'] } },
        select: { partnerId: true, totalAmount: true },
      });
      for (const sale of sales) {
        points.set(sale.partnerId, (points.get(sale.partnerId) ?? ZERO).plus(moneyFromDatabase(sale.totalAmount)));
      }
    }
    return buildTree(partners).map((node) => decorateOrg(node, members, points).node);
  }

  async commissionReport(actor: AuthUser, fromInput: string, toInput: string): Promise<CommissionReport> {
    const gate = await this.access.principal(actor, 'reports');
    actor = gate.line;
    const fromDay = parseIsoDate(fromInput);
    const toDay = parseIsoDate(toInput);
    const span = Math.round((toDay.getTime() - fromDay.getTime()) / 86_400_000);
    if (span < 0 || span > 366) {
      throw new DomainError('INVALID_ITEM');
    }
    const start = cutoffInstant(fromDay, '00:00:00');
    const end = cutoffInstant(addUtcDays(toDay, 1), '00:00:00');
    const scope = await this.commissionScope(actor);
    const rows = await this.prisma.$queryRaw<
      Array<{ amount: string; createdAt: Date; batchId: string; label: string; categoryName: string }>
    >`
      SELECT c.amount::text AS amount,
             c."createdAt" AS "createdAt",
             b.id AS "batchId",
             b.label AS label,
             cat.name AS "categoryName"
      FROM "CommissionRecord" c
      JOIN "Partner" p ON p.id = c."partnerId"
      JOIN "CouponTx" t ON t.id = c."transactionId"
      JOIN "CouponBatch" b ON b.id = t."batchId"
      JOIN "CouponCategory" cat ON cat.id = b."categoryId"
      WHERE c."createdAt" >= ${start} AND c."createdAt" < ${end}
        AND ${scope}
      ORDER BY c."createdAt" ASC
    `;
    const byDay = new Map<string, Decimal>();
    const byBatch = new Map<string, { label: string; categoryName: string; amount: Decimal }>();
    let total = ZERO;
    for (const row of rows) {
      const amount = moneyFromDatabase(row.amount);
      total = total.plus(amount);
      const date = formatBangkokDate(row.createdAt);
      byDay.set(date, (byDay.get(date) ?? ZERO).plus(amount));
      const current = byBatch.get(row.batchId) ?? { label: row.label, categoryName: row.categoryName, amount: ZERO };
      current.amount = current.amount.plus(amount);
      byBatch.set(row.batchId, current);
    }
    return {
      from: fromInput,
      to: toInput,
      total: formatMoney(total),
      byDay: [...byDay.entries()].map(([date, amount]) => ({ date, amount: formatMoney(amount) })),
      byBatch: [...byBatch.entries()]
        .map(([batchId, row]) => ({
          batchId,
          label: row.label,
          categoryName: row.categoryName,
          amount: formatMoney(row.amount),
        }))
        .sort((left, right) => right.amount.localeCompare(left.amount) || left.label.localeCompare(right.label)),
    };
  }

  async hierarchy(actor: AuthUser): Promise<PartnerTreeNode[]> {
    return buildTree(await this.visiblePartners(actor));
  }

  async list(actor: AuthUser): Promise<PartnerView[]> {
    return this.visiblePartners(actor);
  }

  async get(actor: AuthUser, id: string): Promise<PartnerView> {
    const partner = await this.requirePartner(id);
    await this.assertCanSee(actor, partner.path);
    return partner;
  }

  async create(actor: AuthUser, dto: CreatePartnerDto): Promise<PartnerView> {
    const gate = await this.access.principal(actor, 'members');
    actor = gate.line;
    const parent = dto.parentId ? await this.requirePartner(dto.parentId) : null;
    if (!parent && actor.role !== 'SUPER_ADMIN') {
      throw new DomainError('PARTNER_SCOPE');
    }
    if (parent) {
      await this.assertCanAttach(actor, parent);
    }
    const rates = await this.normalizeRates(dto.commissionRates);
    const path = childPath(parent?.path ?? null, dto.code);
    try {
      const created = await this.prisma.partner.create({
        data: {
          code: dto.code,
          name: dto.name.trim(),
          parentId: parent?.id ?? null,
          path,
          distributionMode: dto.distributionMode,
          commissionRates: rates,
        },
      });
      return this.toView(created);
    } catch (error) {
      if (isUnique(error)) {
        throw new DomainError('CONFLICT');
      }
      throw error;
    }
  }

  async update(actor: AuthUser, id: string, dto: UpdatePartnerDto): Promise<PartnerView> {
    const gate = await this.access.principal(actor, 'members');
    actor = gate.line;
    if (dto.name === undefined && dto.isActive === undefined) {
      throw new DomainError('INVALID_ITEM');
    }
    const partner = await this.requirePartner(id);
    await this.assertCanSee(actor, partner.path);
    const updated = await this.prisma.partner.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return this.toView(updated);
  }

  async updateCommercial(actor: AuthUser, id: string, dto: UpdateCommercialDto): Promise<PartnerView> {
    const gate = await this.access.principal(actor, 'members');
    actor = gate.line;
    if (dto.distributionMode === undefined && dto.commissionRates === undefined) {
      throw new DomainError('INVALID_ITEM');
    }
    const partner = await this.requirePartner(id);
    if (actor.role === 'MASTER_PARTNER') {
      await this.assertStrictDescendant(actor, partner.path);
    } else if (actor.role !== 'SUPER_ADMIN') {
      throw new DomainError('FORBIDDEN');
    }
    const rates = dto.commissionRates ? await this.normalizeRates(dto.commissionRates) : undefined;
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.partner.update({
        where: { id },
        data: {
          ...(dto.distributionMode ? { distributionMode: dto.distributionMode } : {}),
          ...(rates ? { commissionRates: rates } : {}),
        },
      });
      const view = this.toView(row);
      await this.audit.append(tx, {
        actorId: gate.actorId,
        action: 'COMMISSION_RATE_UPDATE',
        target: row.id,
        detail: {
          code: row.code,
          distributionMode: view.distributionMode,
          commissionRates: view.commissionRates,
        },
      });
      return view;
    });
    return updated;
  }

  async remove(actor: AuthUser, id: string): Promise<{ id: string; removed: boolean; isActive: boolean }> {
    const gate = await this.access.principal(actor, 'members');
    actor = gate.line;
    const partner = await this.requirePartner(id);
    if (actor.role === 'MASTER_PARTNER') {
      await this.assertStrictDescendant(actor, partner.path);
    } else if (actor.role !== 'SUPER_ADMIN') {
      throw new DomainError('FORBIDDEN');
    }
    const [children, users, transactions] = await Promise.all([
      this.prisma.partner.count({ where: { parentId: id } }),
      this.prisma.user.count({ where: { partnerId: id } }),
      this.prisma.couponTx.count({ where: { partnerId: id } }),
    ]);
    if (children > 0 || users > 0 || transactions > 0) {
      const updated = await this.prisma.partner.update({ where: { id }, data: { isActive: false } });
      return { id, removed: false, isActive: updated.isActive };
    }
    await this.prisma.partner.delete({ where: { id } });
    return { id, removed: true, isActive: false };
  }

  private async commissionScope(actor: AuthUser): Promise<Prisma.Sql> {
    if (actor.role === 'SUPER_ADMIN') {
      return Prisma.sql`TRUE`;
    }
    if (!actor.partnerId) {
      throw new DomainError('NOT_ATTACHED');
    }
    const self = await this.requirePartner(actor.partnerId);
    return Prisma.sql`p.path <@ ${self.path}::ltree`;
  }

  private async visiblePartners(actor: AuthUser): Promise<PartnerView[]> {
    if (actor.role === 'SUPER_ADMIN') {
      const rows = await this.prisma.$queryRaw<PartnerRow[]>`
        SELECT id, code, name, "parentId", path::text AS path,
               "distributionMode"::text AS "distributionMode",
               "commissionRates", "isActive"
        FROM "Partner"
        ORDER BY nlevel(path) ASC, code ASC
      `;
      return rows.map((row) => this.rowToView(row));
    }
    if (!actor.partnerId) {
      throw new DomainError('NOT_ATTACHED');
    }
    const self = await this.requirePartner(actor.partnerId);
    const rows = await this.prisma.$queryRaw<PartnerRow[]>`
      SELECT id, code, name, "parentId", path::text AS path,
             "distributionMode"::text AS "distributionMode",
             "commissionRates", "isActive"
      FROM "Partner"
      WHERE path <@ ${self.path}::ltree
      ORDER BY nlevel(path) ASC, code ASC
    `;
    return rows.map((row) => this.rowToView(row));
  }

  private async assertCanSee(actor: AuthUser, path: string): Promise<void> {
    if (actor.role === 'SUPER_ADMIN') {
      return;
    }
    if (!actor.partnerId) {
      throw new DomainError('NOT_ATTACHED');
    }
    const self = await this.requirePartner(actor.partnerId);
    const relation = await this.relation(self.path, path);
    if (!relation.contains) {
      throw new DomainError('PARTNER_SCOPE');
    }
  }

  private async assertCanAttach(actor: AuthUser, parent: PartnerView): Promise<void> {
    if (actor.role === 'SUPER_ADMIN') {
      return;
    }
    if (!actor.partnerId) {
      throw new DomainError('NOT_ATTACHED');
    }
    const self = await this.requirePartner(actor.partnerId);
    if (parent.id === self.id) {
      return;
    }
    const relation = await this.relation(self.path, parent.path);
    if (!relation.contains || !relation.deeper) {
      throw new DomainError('PARTNER_SCOPE');
    }
  }

  private async assertStrictDescendant(actor: AuthUser, path: string): Promise<void> {
    if (!actor.partnerId) {
      throw new DomainError('NOT_ATTACHED');
    }
    const self = await this.requirePartner(actor.partnerId);
    const relation = await this.relation(self.path, path);
    if (!relation.contains || !relation.deeper) {
      throw new DomainError('PARTNER_SCOPE');
    }
  }

  private async relation(ancestorPath: string, nodePath: string): Promise<{ contains: boolean; deeper: boolean }> {
    const rows = await this.prisma.$queryRaw<Array<{ contains: boolean; deeper: boolean }>>`
      SELECT
        (${nodePath}::ltree <@ ${ancestorPath}::ltree) AS contains,
        (nlevel(${nodePath}::ltree) > nlevel(${ancestorPath}::ltree)) AS deeper
    `;
    return rows[0] ?? { contains: false, deeper: false };
  }

  private async requirePartner(id: string): Promise<PartnerView> {
    const partner = await this.prisma.partner.findUnique({ where: { id } });
    if (!partner) {
      throw new DomainError('PARTNER_SCOPE');
    }
    return this.toView(partner);
  }

  private async normalizeRates(input: Record<string, string>): Promise<Record<string, string>> {
    const categories = await this.prisma.couponCategory.findMany({ select: { code: true } });
    return normalizeCommissionRates(input, categories.map((category) => category.code));
  }

  private toView(partner: {
    id: string;
    code: string;
    name: string;
    parentId: string | null;
    path: string;
    distributionMode: string;
    commissionRates: unknown;
    isActive: boolean;
  }): PartnerView {
    return this.rowToView(partner);
  }

  private rowToView(row: PartnerRow): PartnerView {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      parentId: row.parentId,
      path: row.path,
      distributionMode: row.distributionMode,
      commissionRates: readCommissionRates(row.commissionRates),
      isActive: row.isActive,
    };
  }
}

function buildTree(rows: PartnerView[]): PartnerTreeNode[] {
  const nodes = new Map<string, PartnerTreeNode>();
  for (const row of rows) {
    nodes.set(row.id, { ...row, children: [] });
  }
  const roots: PartnerTreeNode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id);
    if (!node) {
      continue;
    }
    const parent = row.parentId ? nodes.get(row.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function decorateOrg(
  node: PartnerTreeNode,
  members: Map<string, number>,
  points: Map<string, Decimal>,
): { node: OrgChartNode; members: number; flow: Decimal } {
  const children = node.children.map((child) => decorateOrg(child, members, points));
  const memberCount = (members.get(node.id) ?? 0) + children.reduce((sum, child) => sum + child.members, 0);
  let flow = points.get(node.id) ?? ZERO;
  for (const child of children) {
    flow = flow.plus(child.flow);
  }
  return {
    members: memberCount,
    flow,
    node: {
      id: node.id,
      code: node.code,
      name: node.name,
      parentId: node.parentId,
      path: node.path,
      distributionMode: node.distributionMode,
      commissionRates: node.commissionRates,
      isActive: node.isActive,
      childPartnerCount: node.children.length,
      activeMemberCount: memberCount,
      pointsFlow: formatMoney(flow),
      children: children.map((child) => child.node),
    },
  };
}

function parseIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new DomainError('INVALID_ITEM');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new DomainError('INVALID_ITEM');
  }
  return date;
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function formatBangkokDate(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
  return parts;
}

function isUnique(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002';
}
