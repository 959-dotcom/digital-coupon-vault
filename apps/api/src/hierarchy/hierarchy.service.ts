import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { AccessService } from '../access/access.service.js';
import { AuditLogService } from '../audit/audit-log.service.js';
import type { AuthUser, RoleName } from '../auth/auth-user.js';
import { DomainError } from '../common/domain-error.js';
import { Decimal, ZERO, formatMoney, moneyFromDatabase } from '../money/decimal.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { splitHoldWaterfall, type HoldSlice } from './hold-waterfall.js';
import { assertAssignableRole } from './member-role.js';

const HUNDRED = new Decimal(100);

type LineRow = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  parentId: string | null;
  path: string;
  referralCode: string;
  holdPercent: string;
  commissionOnly: boolean;
  isActive: boolean;
  partnerId: string | null;
};

export type LineNode = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  referralCode: string;
  holdPercent: string;
  commissionOnly: boolean;
  isActive: boolean;
  direct: boolean;
  credit: string;
  sales: string;
  commission: string;
  children: LineNode[];
};

type Settings = {
  adminBasePercent: Decimal;
  percentLockMode: 'ADMIN_LOCK' | 'SELF_MANAGE';
};

@Injectable()
export class HierarchyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditLogService,
  ) {}

  async referral(actor: AuthUser): Promise<{ code: string; path: string }> {
    const user = await this.requireRow(actor.userId);
    return { code: user.referralCode, path: `/register?ref=${user.referralCode}` };
  }

  async line(actor: AuthUser): Promise<LineNode[]> {
    const gate = await this.access.viewLine(actor);
    const rows = await this.visibleRows(gate.line);
    const ids = rows.map((row) => row.id);
    const credit = new Map<string, Decimal>();
    const sales = new Map<string, Decimal>();
    const commission = new Map<string, Decimal>();
    if (ids.length > 0) {
      const accounts = await this.prisma.creditAccount.findMany({ where: { userId: { in: ids } } });
      for (const account of accounts) {
        credit.set(account.userId, moneyFromDatabase(account.balance));
      }
      const bills = await this.prisma.couponTx.findMany({
        where: { userId: { in: ids }, status: { in: ['CONFIRMED', 'SETTLED'] } },
        select: { userId: true, totalAmount: true },
      });
      for (const bill of bills) {
        sales.set(bill.userId, (sales.get(bill.userId) ?? ZERO).plus(moneyFromDatabase(bill.totalAmount)));
      }
      const shares = await this.prisma.billShare.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, amount: true },
      });
      for (const share of shares) {
        commission.set(share.userId, (commission.get(share.userId) ?? ZERO).plus(moneyFromDatabase(share.amount)));
      }
    }
    const rolledSales = rollSales(rows, sales);
    const nodes = buildLine(rows, credit, rolledSales, commission, gate.line.userId);
    if (!gate.showCredit) {
      blankCredit(nodes);
    }
    return nodes;
  }

  async createDownline(
    actor: AuthUser,
    input: {
      email: string;
      passwordHash: string;
      displayName: string;
      commissionOnly: boolean;
      role?: RoleName;
      holdPercent?: string;
      isActive?: boolean;
    },
    ip?: string,
  ): Promise<{ id: string; email: string; role: RoleName; referralCode: string }> {
    const gate = await this.access.principal(actor, 'members');
    const created = await this.provision({
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      commissionOnly: input.commissionOnly,
      parentId: gate.line.userId,
      role: input.role,
      holdPercent: input.holdPercent,
      isActive: input.isActive,
    });
    await this.audit.append(this.prisma, {
      actorId: gate.actorId,
      action: 'DOWNLINE_CREATE',
      target: created.id,
      detail: {
        email: created.email,
        role: created.role,
        commissionOnly: input.commissionOnly,
        holdPercent: input.holdPercent ?? '0.00',
        isActive: input.isActive ?? true,
      },
      ip,
    });
    return created;
  }

  async provision(input: {
    email: string;
    passwordHash: string;
    displayName: string;
    commissionOnly: boolean;
    parentId?: string;
    referralCode?: string;
    role?: RoleName;
    holdPercent?: string;
    isActive?: boolean;
    phone?: string;
    pinHash?: string;
    bankProvider?: 'BBL' | 'KBANK' | 'KTB' | 'SCB' | 'BAY' | 'TTB' | 'GSB' | 'BAAC' | 'UOB' | 'CIMB' | 'KKP' | 'LHB' | 'TCRB' | 'TRUEWALLET';
    bankAccountNo?: string;
    accountName?: string;
    lineId?: string | null;
    sourceChannel?: 'FACEBOOK' | 'TIKTOK' | 'GOOGLE' | 'FRIEND' | 'YOUTUBE' | 'OTHER';
  }): Promise<{ id: string; email: string; role: RoleName; referralCode: string }> {
    const parent = input.parentId
      ? await this.requireRow(input.parentId)
      : await this.findByReferral(input.referralCode ?? '');
    if (!parent.isActive) {
      throw new DomainError('USER_INACTIVE');
    }
    const role = input.role ?? childRole(parent.role);
    assertAssignableRole(parent.role, role);
    const hold = input.holdPercent ? parsePercent(input.holdPercent) : ZERO;
    const settings = await this.settings();
    const above =
      parent.role === 'SUPER_ADMIN' ? ZERO : (await this.uplineHolds(parent)).plus(moneyFromDatabase(parent.holdPercent));
    if (!holdsFit(above.plus(hold), settings.adminBasePercent)) {
      throw new DomainError('HOLD_CAP');
    }
    const referralCode = newReferralCode();
    const path = `${parent.path}.${referralCode}`;
    try {
      const created = await this.prisma.user.create({
        data: {
          email: input.email.trim().toLowerCase(),
          passwordHash: input.passwordHash,
          displayName: input.displayName.trim(),
          role,
          partnerId: parent.partnerId,
          parentId: parent.id,
          path,
          referralCode,
          holdPercent: hold.toFixed(2),
          commissionOnly: input.commissionOnly,
          isActive: input.isActive ?? true,
          phone: input.phone,
          pinHash: input.pinHash,
          bankProvider: input.bankProvider,
          bankAccountNo: input.bankAccountNo,
          accountName: input.accountName,
          lineId: input.lineId,
          sourceChannel: input.sourceChannel,
          creditAccount: { create: { balance: '0.0000' } },
        },
      });
      return { id: created.id, email: created.email, role, referralCode };
    } catch (error) {
      if (isUnique(error)) {
        throw new DomainError('CONFLICT');
      }
      throw error;
    }
  }

  async updateHold(actor: AuthUser, userId: string, holdInput: string, ip?: string): Promise<{ id: string; holdPercent: string }> {
    const gate = await this.access.principal(actor, 'members');
    const hold = parsePercent(holdInput);
    const target = await this.requireRow(userId);
    await this.assertCanEditHold(gate.line, target);
    if (target.role === 'SUPER_ADMIN') {
      throw new DomainError('HOLD_CAP');
    }
    const settings = await this.settings();
    const upline = await this.uplineHolds(target);
    const below = await this.tightestDownlineHold(target);
    if (!holdsFit(upline.plus(hold).plus(below), settings.adminBasePercent)) {
      throw new DomainError('HOLD_CAP');
    }
    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data: { holdPercent: hold.toFixed(2) },
    });
    await this.audit.append(this.prisma, {
      actorId: gate.actorId,
      action: 'HOLD_UPDATE',
      target: updated.id,
      detail: { holdPercent: moneyPercent(updated.holdPercent) },
      ip,
    });
    return { id: updated.id, holdPercent: moneyPercent(updated.holdPercent) };
  }

  async updateMode(actor: AuthUser, userId: string, commissionOnly: boolean, ip?: string): Promise<{ id: string; commissionOnly: boolean }> {
    const gate = await this.access.principal(actor, 'members');
    const target = await this.requireRow(userId);
    await this.assertCanToggleMode(gate.line, target);
    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data: { commissionOnly },
    });
    await this.audit.append(this.prisma, {
      actorId: gate.actorId,
      action: 'MODE_UPDATE',
      target: updated.id,
      detail: { commissionOnly },
      ip,
    });
    return { id: updated.id, commissionOnly: updated.commissionOnly };
  }

  async updateMember(
    actor: AuthUser,
    userId: string,
    input: {
      displayName?: string;
      role?: RoleName;
      commissionOnly?: boolean;
      holdPercent?: string;
      isActive?: boolean;
    },
    ip?: string,
  ): Promise<{ id: string; displayName: string; role: RoleName; commissionOnly: boolean; holdPercent: string; isActive: boolean }> {
    const gate = await this.access.principal(actor, 'members');
    const target = await this.requireDirect(gate.line.userId, userId);
    const data: Prisma.UserUpdateInput = {};
    const detail: Record<string, string | boolean> = {};
    if (input.displayName !== undefined) {
      data.displayName = input.displayName.trim();
      detail.displayName = input.displayName.trim();
    }
    if (input.role !== undefined) {
      assertAssignableRole(gate.line.role, input.role);
      data.role = input.role;
      detail.role = input.role;
    }
    if (input.commissionOnly !== undefined) {
      data.commissionOnly = input.commissionOnly;
      detail.commissionOnly = input.commissionOnly;
    }
    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
      detail.isActive = input.isActive;
    }
    if (input.holdPercent !== undefined) {
      const hold = parsePercent(input.holdPercent);
      const settings = await this.settings();
      const upline = await this.uplineHolds(target);
      const below = await this.tightestDownlineHold(target);
      if (!holdsFit(upline.plus(hold).plus(below), settings.adminBasePercent)) {
        throw new DomainError('HOLD_CAP');
      }
      data.holdPercent = hold.toFixed(2);
      detail.holdPercent = hold.toFixed(2);
    }
    if (Object.keys(data).length === 0) {
      throw new DomainError('INVALID_AMOUNT');
    }
    const updated = await this.prisma.user.update({ where: { id: target.id }, data });
    await this.audit.append(this.prisma, {
      actorId: gate.actorId,
      action: 'MEMBER_UPDATE',
      target: updated.id,
      detail,
      ip,
    });
    return {
      id: updated.id,
      displayName: updated.displayName,
      role: updated.role,
      commissionOnly: updated.commissionOnly,
      holdPercent: moneyPercent(updated.holdPercent),
      isActive: updated.isActive,
    };
  }

  async resetPassword(actor: AuthUser, userId: string, passwordHash: string, ip?: string): Promise<{ id: string }> {
    const gate = await this.access.principal(actor, 'members');
    const target = await this.requireDirect(gate.line.userId, userId);
    await this.prisma.user.update({ where: { id: target.id }, data: { passwordHash } });
    await this.audit.append(this.prisma, {
      actorId: gate.actorId,
      action: 'PASSWORD_RESET',
      target: target.id,
      detail: { userId: target.id },
      ip,
    });
    return { id: target.id };
  }

  async updateSettings(
    actor: AuthUser,
    adminBaseInput: string,
    percentLockMode: 'ADMIN_LOCK' | 'SELF_MANAGE',
  ): Promise<{ adminBasePercent: string; percentLockMode: 'ADMIN_LOCK' | 'SELF_MANAGE' }> {
    await this.access.denyStaff(actor);
    if (actor.role !== 'SUPER_ADMIN') {
      throw new DomainError('FORBIDDEN');
    }
    const adminBase = parsePercent(adminBaseInput);
    if (adminBase.lt(5) || adminBase.gt(100)) {
      throw new DomainError('HOLD_CAP');
    }
    const rows = await this.prisma.$queryRaw<Array<{ path: string; holdPercent: string; role: string }>>`
      SELECT path::text AS path, "holdPercent"::text AS "holdPercent", role::text AS role
      FROM "User"
    `;
    const offenders = leafPaths(rows).filter((holds) => !holdsFit(holds.reduce((sum, hold) => sum.plus(hold), ZERO), adminBase));
    if (offenders.length > 0) {
      throw new DomainError('HOLD_CAP');
    }
    const saved = await this.prisma.$transaction(async (tx) => {
      const row = await tx.systemSetting.upsert({
      where: { id: 'default' },
      update: { adminBasePercent: adminBase.toFixed(2), percentLockMode },
      create: { id: 'default', adminBasePercent: adminBase.toFixed(2), percentLockMode },
    });
      await this.audit.append(tx, {
        actorId: actor.userId,
        action: 'SETTINGS_UPDATE',
        target: 'default',
        detail: { adminBasePercent: adminBase.toFixed(2), percentLockMode },
      });
      return row;
    });
    return {
      adminBasePercent: moneyPercent(saved.adminBasePercent),
      percentLockMode: saved.percentLockMode,
    };
  }

  async holdBar(actor: AuthUser): Promise<{
    adminBasePercent: string;
    percentLockMode: 'ADMIN_LOCK' | 'SELF_MANAGE';
    uplineHolds: Array<{ id: string; displayName: string; holdPercent: string }>;
    ownHoldPercent: string;
    remainingDownlineQuota: string;
    maxOwnHold: string;
    canEditOwn: boolean;
  }> {
    const self = await this.requireRow(actor.userId);
    const settings = await this.settings();
    const uplineRows = await this.uplineRows(self);
    const uplineSum = uplineRows.reduce((sum, row) => sum.plus(moneyFromDatabase(row.holdPercent)), ZERO);
    const below = await this.tightestDownlineHold(self);
    const own = moneyFromDatabase(self.holdPercent);
    const cap = HUNDRED.minus(settings.adminBasePercent);
    const remaining = Decimal.max(cap.minus(uplineSum).minus(own), ZERO);
    const maxOwn = Decimal.max(cap.minus(uplineSum).minus(below), ZERO);
    return {
      adminBasePercent: settings.adminBasePercent.toFixed(2),
      percentLockMode: settings.percentLockMode,
      uplineHolds: uplineRows.map((row) => ({
        id: row.id,
        displayName: row.displayName,
        holdPercent: moneyPercent(row.holdPercent),
      })),
      ownHoldPercent: own.toFixed(2),
      remainingDownlineQuota: remaining.toFixed(2),
      maxOwnHold: maxOwn.toFixed(2),
      canEditOwn: actor.role === 'SUPER_ADMIN' || (settings.percentLockMode === 'SELF_MANAGE' && self.role !== 'SUPER_ADMIN'),
    };
  }

  async recordBillShares(
    tx: Prisma.TransactionClient,
    sellerId: string,
    bill: Decimal,
    transactionId: string,
  ): Promise<void> {
    const seller = await tx.user.findUnique({ where: { id: sellerId } });
    if (!seller) {
      throw new DomainError('USER_INACTIVE');
    }
    const chain = await tx.$queryRaw<Array<{ id: string; holdPercent: string; role: string }>>`
      SELECT id, "holdPercent"::text AS "holdPercent", role::text AS role
      FROM "User"
      WHERE ${seller.path}::ltree <@ path
      ORDER BY nlevel(path) DESC
    `;
    const admin = [...chain].reverse().find((row) => row.role === 'SUPER_ADMIN') ?? chain[chain.length - 1];
    if (!admin) {
      throw new DomainError('NOT_ATTACHED');
    }
    const people = chain
      .filter((row) => row.role !== 'SUPER_ADMIN')
      .map((row) => ({ id: row.id, holdPercent: moneyFromDatabase(row.holdPercent) }));
    const settings = await this.settings(tx);
    let waterfall;
    try {
      waterfall = splitHoldWaterfall(bill, settings.adminBasePercent, people, admin.id);
    } catch (error) {
      if (error instanceof Error && (error.message === 'HOLD_CAP' || error.message === 'INVALID_AMOUNT')) {
        throw new DomainError(error.message);
      }
      throw error;
    }
    const slices = [...waterfall.nodes, waterfall.admin];
    await tx.billShare.createMany({
      data: slices.map((slice) => shareData(transactionId, slice)),
    });
  }

  private async settings(db: Prisma.TransactionClient | PrismaService = this.prisma): Promise<Settings> {
    const row = await db.systemSetting.findUnique({ where: { id: 'default' } });
    return {
      adminBasePercent: row ? moneyFromDatabase(row.adminBasePercent) : new Decimal(5),
      percentLockMode: row?.percentLockMode ?? 'ADMIN_LOCK',
    };
  }

  private async visibleRows(actor: AuthUser): Promise<LineRow[]> {
    if (actor.role === 'SUPER_ADMIN') {
      return this.prisma.$queryRaw<LineRow[]>`
        SELECT id, email, "displayName", role::text AS role, "parentId", path::text AS path,
               "referralCode", "holdPercent"::text AS "holdPercent", "commissionOnly", "isActive", "partnerId"
        FROM "User"
        WHERE "isStaff" = false
        ORDER BY nlevel(path) ASC, email ASC
      `;
    }
    const self = await this.requireRow(actor.userId);
    return this.prisma.$queryRaw<LineRow[]>`
      SELECT id, email, "displayName", role::text AS role, "parentId", path::text AS path,
             "referralCode", "holdPercent"::text AS "holdPercent", "commissionOnly", "isActive", "partnerId"
      FROM "User"
      WHERE path <@ ${self.path}::ltree
        AND "isStaff" = false
      ORDER BY nlevel(path) ASC, email ASC
    `;
  }

  private async requireDirect(principalId: string, userId: string): Promise<LineRow & { isStaff: boolean }> {
    const target = await this.requireRow(userId);
    if (target.isStaff || target.parentId !== principalId) {
      throw new DomainError('NOT_DIRECT_CHILD');
    }
    return target;
  }

  private async requireRow(id: string): Promise<LineRow & { isStaff: boolean }> {
    const rows = await this.prisma.$queryRaw<Array<LineRow & { isStaff: boolean }>>`
      SELECT id, email, "displayName", role::text AS role, "parentId", path::text AS path,
             "referralCode", "holdPercent"::text AS "holdPercent", "commissionOnly", "isActive", "partnerId",
             "isStaff"
      FROM "User"
      WHERE id = ${id}
    `;
    const row = rows[0];
    if (!row) {
      throw new DomainError('PARTNER_SCOPE');
    }
    return row;
  }

  private async findByReferral(code: string): Promise<LineRow & { isStaff: boolean }> {
    const rows = await this.prisma.$queryRaw<Array<LineRow & { isStaff: boolean }>>`
      SELECT id, email, "displayName", role::text AS role, "parentId", path::text AS path,
             "referralCode", "holdPercent"::text AS "holdPercent", "commissionOnly", "isActive", "partnerId",
             "isStaff"
      FROM "User"
      WHERE "referralCode" = ${code}
    `;
    const row = rows[0];
    if (!row) {
      throw new DomainError('INVALID_REF');
    }
    return row;
  }

  private async assertCanEditHold(actor: AuthUser, target: LineRow): Promise<void> {
    if (actor.role === 'SUPER_ADMIN') {
      return;
    }
    const settings = await this.settings();
    if (settings.percentLockMode !== 'SELF_MANAGE') {
      throw new DomainError('HOLD_LOCKED');
    }
    if (actor.userId !== target.id && target.parentId !== actor.userId) {
      throw new DomainError('FORBIDDEN');
    }
    const self = await this.requireRow(actor.userId);
    if (target.path !== self.path && !target.path.startsWith(`${self.path}.`)) {
      throw new DomainError('PARTNER_SCOPE');
    }
  }

  private async assertCanToggleMode(actor: AuthUser, target: LineRow): Promise<void> {
    if (actor.role === 'SUPER_ADMIN') {
      return;
    }
    const settings = await this.settings();
    if (settings.percentLockMode !== 'SELF_MANAGE' || target.parentId !== actor.userId) {
      throw new DomainError('HOLD_LOCKED');
    }
  }

  private async uplineRows(target: LineRow): Promise<LineRow[]> {
    const rows = await this.prisma.$queryRaw<LineRow[]>`
      SELECT id, email, "displayName", role::text AS role, "parentId", path::text AS path,
             "referralCode", "holdPercent"::text AS "holdPercent", "commissionOnly", "partnerId"
      FROM "User"
      WHERE ${target.path}::ltree <@ path
        AND id <> ${target.id}
        AND role::text <> 'SUPER_ADMIN'
      ORDER BY nlevel(path) ASC
    `;
    return rows;
  }

  private async uplineHolds(target: LineRow): Promise<Decimal> {
    const rows = await this.uplineRows(target);
    return rows.reduce((sum, row) => sum.plus(moneyFromDatabase(row.holdPercent)), ZERO);
  }

  private async tightestDownlineHold(target: LineRow): Promise<Decimal> {
    const rows = await this.prisma.$queryRaw<Array<{ path: string; holdPercent: string }>>`
      SELECT path::text AS path, "holdPercent"::text AS "holdPercent"
      FROM "User"
      WHERE path <@ ${target.path}::ltree
        AND id <> ${target.id}
        AND role::text <> 'SUPER_ADMIN'
    `;
    if (rows.length === 0) {
      return ZERO;
    }
    const byParent = new Map<string, Array<{ path: string; hold: Decimal }>>();
    for (const row of rows) {
      const parentPath = row.path.slice(0, row.path.lastIndexOf('.'));
      const list = byParent.get(parentPath) ?? [];
      list.push({ path: row.path, hold: moneyFromDatabase(row.holdPercent) });
      byParent.set(parentPath, list);
    }
    const walk = (path: string): Decimal => {
      const children = byParent.get(path) ?? [];
      if (children.length === 0) {
        return ZERO;
      }
      return children.reduce((max, child) => Decimal.max(max, child.hold.plus(walk(child.path))), ZERO);
    };
    return walk(target.path);
  }
}

function shareData(transactionId: string, slice: HoldSlice) {
  return {
    transactionId,
    userId: slice.id,
    holdPercent: slice.holdPercent.toFixed(2),
    amount: formatMoney(slice.amount),
    receivedFromBelow: formatMoney(slice.receivedFromBelow),
    sentUpward: formatMoney(slice.sentUpward),
  };
}

function parsePercent(input: string): Decimal {
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(input)) {
    throw new DomainError('INVALID_AMOUNT');
  }
  const parsed = new Decimal(input);
  if (parsed.lt(0) || parsed.gt(100)) {
    throw new DomainError('HOLD_CAP');
  }
  return parsed.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function holdsFit(sum: Decimal, adminBase: Decimal): boolean {
  return sum.lte(HUNDRED.minus(adminBase));
}

function moneyPercent(value: { toString(): string } | string | Decimal): string {
  return moneyFromDatabase(value).toFixed(2);
}

function childRole(parentRole: string): RoleName {
  if (parentRole === 'SUPER_ADMIN') {
    return 'MASTER_PARTNER';
  }
  if (parentRole === 'MASTER_PARTNER') {
    return 'PARTNER';
  }
  return 'MEMBER';
}

function newReferralCode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(7);
  let code = 'u';
  for (const byte of bytes) {
    code += alphabet[byte % alphabet.length];
  }
  return code;
}

function isUnique(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002';
}

function blankCredit(nodes: LineNode[]): void {
  for (const node of nodes) {
    node.credit = '0.0000';
    blankCredit(node.children);
  }
}

function buildLine(
  rows: LineRow[],
  credit: Map<string, Decimal>,
  sales: Map<string, Decimal>,
  commission: Map<string, Decimal>,
  viewerId: string,
): LineNode[] {
  const nodes = new Map<string, LineNode>();
  for (const row of rows) {
    nodes.set(row.id, {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      role: row.role,
      referralCode: row.referralCode,
      holdPercent: moneyPercent(row.holdPercent),
      commissionOnly: row.commissionOnly,
      isActive: row.isActive,
      direct: row.parentId === viewerId,
      credit: formatMoney(credit.get(row.id) ?? ZERO),
      sales: formatMoney(sales.get(row.id) ?? ZERO),
      commission: formatMoney(commission.get(row.id) ?? ZERO),
      children: [],
    });
  }
  const roots: LineNode[] = [];
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

function rollSales(rows: LineRow[], own: Map<string, Decimal>): Map<string, Decimal> {
  const children = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.parentId) {
      continue;
    }
    const list = children.get(row.parentId) ?? [];
    list.push(row.id);
    children.set(row.parentId, list);
  }
  const totals = new Map<string, Decimal>();
  const walk = (id: string): Decimal => {
    const cached = totals.get(id);
    if (cached) {
      return cached;
    }
    let sum = own.get(id) ?? ZERO;
    for (const child of children.get(id) ?? []) {
      sum = sum.plus(walk(child));
    }
    totals.set(id, sum);
    return sum;
  };
  for (const row of rows) {
    walk(row.id);
  }
  return totals;
}

function leafPaths(rows: Array<{ path: string; holdPercent: string; role: string }>): Decimal[][] {
  const byPath = new Map(rows.map((row) => [row.path, row]));
  const childPaths = new Set(
    rows
      .map((row) => {
        const dot = row.path.lastIndexOf('.');
        return dot > 0 ? row.path.slice(0, dot) : '';
      })
      .filter(Boolean),
  );
  const leaves = rows.filter((row) => !childPaths.has(row.path) && row.role !== 'SUPER_ADMIN');
  return leaves.map((leaf) => {
    const holds: Decimal[] = [];
    const parts = leaf.path.split('.');
    for (let index = 1; index <= parts.length; index += 1) {
      const path = parts.slice(0, index).join('.');
      const row = byPath.get(path);
      if (row && row.role !== 'SUPER_ADMIN') {
        holds.push(moneyFromDatabase(row.holdPercent));
      }
    }
    return holds;
  });
}
