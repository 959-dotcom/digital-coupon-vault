import { Injectable } from '@nestjs/common';
import { AuditLogService } from '../audit/audit-log.service.js';
import { AccessService } from '../access/access.service.js';
import { closedByAncestor, isProductCode, PRODUCT_CODES, productName, type ProductCode } from '../access/permissions.js';
import type { AuthUser } from '../auth/auth-user.js';
import { DomainError } from '../common/domain-error.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditLogService,
  ) {}

  async list(actor: AuthUser) {
    const gate = await this.access.viewLine(actor);
    const viewer = await this.prisma.user.findUnique({ where: { id: gate.line.userId } });
    if (!viewer) {
      throw new DomainError('USER_INACTIVE');
    }
    const ancestors = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "User" WHERE ${viewer.path}::ltree <@ path ORDER BY nlevel(path) DESC
    `;
    const ids = ancestors.map((row) => row.id);
    const flags = ids.length
      ? await this.prisma.lineProduct.findMany({ where: { userId: { in: ids }, code: { in: [...PRODUCT_CODES] } } })
      : [];
    return PRODUCT_CODES.map((code) => {
      const own = flags.find((flag) => flag.userId === viewer.id && flag.code === code);
      const relevant = flags.filter((flag) => flag.code === code).map((flag) => ({ userId: flag.userId, isActive: flag.isActive }));
      return {
        code,
        name: productName(code),
        isActive: !closedByAncestor(relevant, ids),
        ownActive: own ? own.isActive : true,
      };
    });
  }

  async set(actor: AuthUser, code: string, isActive: boolean, ip: string) {
    if (!isProductCode(code)) {
      throw new DomainError('UNKNOWN_CATEGORY');
    }
    const gate = await this.access.principal(actor, 'members');
    const saved = await this.prisma.lineProduct.upsert({
      where: { userId_code: { userId: gate.line.userId, code } },
      update: { isActive, updatedBy: gate.actorId },
      create: { userId: gate.line.userId, code, isActive, updatedBy: gate.actorId },
    });
    await this.audit.append(this.prisma, {
      actorId: gate.actorId,
      action: 'PRODUCT_TOGGLE',
      target: `${gate.line.userId}:${code}`,
      detail: { code, isActive, lineUserId: gate.line.userId },
      ip,
    });
    return { code: saved.code as ProductCode, isActive: saved.isActive };
  }

  async assertOpen(buyerId: string, code: string): Promise<void> {
    if (!isProductCode(code)) {
      return;
    }
    const buyer = await this.prisma.user.findUnique({ where: { id: buyerId } });
    if (!buyer) {
      throw new DomainError('USER_INACTIVE');
    }
    const ancestors = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "User" WHERE ${buyer.path}::ltree <@ path ORDER BY nlevel(path) DESC
    `;
    const ids = ancestors.map((row) => row.id);
    const flags = await this.prisma.lineProduct.findMany({
      where: { code, userId: { in: ids }, isActive: false },
      select: { userId: true, isActive: true },
    });
    if (closedByAncestor(flags, ids)) {
      throw new DomainError('PRODUCT_CLOSED');
    }
  }
}
