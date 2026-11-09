import { Injectable } from '@nestjs/common';
import { DomainError } from '../common/domain-error.js';
import type { AuthUser } from '../auth/auth-user.js';
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
  constructor(private readonly prisma: PrismaService) {}

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
    const updated = await this.prisma.partner.update({
      where: { id },
      data: {
        ...(dto.distributionMode ? { distributionMode: dto.distributionMode } : {}),
        ...(rates ? { commissionRates: rates } : {}),
      },
    });
    return this.toView(updated);
  }

  async remove(actor: AuthUser, id: string): Promise<{ id: string; removed: boolean; isActive: boolean }> {
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

function isUnique(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002';
}
