import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { AuditLogService } from '../audit/audit-log.service.js';
import { AccessService } from '../access/access.service.js';
import { readPermissions, type StaffPermissions } from '../access/permissions.js';
import type { AuthUser, RoleName } from '../auth/auth-user.js';
import { DomainError } from '../common/domain-error.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditLogService,
  ) {}

  async list(actor: AuthUser) {
    const gate = await this.access.principal(actor, 'members');
    const rows = await this.prisma.user.findMany({
      where: { principalId: gate.line.userId, isStaff: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      permissions: readPermissions(row.permissions),
    }));
  }

  async create(
    actor: AuthUser,
    input: { email: string; password: string; displayName: string } & StaffPermissions,
    ip: string,
  ) {
    const gate = await this.access.principal(actor, 'members');
    const principal = await this.prisma.user.findUnique({ where: { id: gate.line.userId } });
    if (!principal) {
      throw new DomainError('USER_INACTIVE');
    }
    const referralCode = newReferralCode();
    const permissions = pick(input);
    try {
      const created = await this.prisma.user.create({
        data: {
          email: input.email.trim().toLowerCase(),
          passwordHash: await bcrypt.hash(input.password, 12),
          displayName: input.displayName.trim(),
          role: principal.role,
          partnerId: principal.partnerId,
          parentId: null,
          path: referralCode,
          referralCode,
          holdPercent: '0.00',
          commissionOnly: true,
          isStaff: true,
          principalId: principal.id,
          permissions,
          creditAccount: { create: { balance: '0.0000' } },
        },
      });
      await this.audit.append(this.prisma, {
        actorId: gate.actorId,
        action: 'STAFF_CREATE',
        target: created.id,
        detail: { email: created.email, principalId: principal.id, permissions },
        ip,
      });
      return { id: created.id, email: created.email, permissions };
    } catch (error) {
      if (isUnique(error)) {
        throw new DomainError('CONFLICT');
      }
      throw error;
    }
  }

  async update(actor: AuthUser, staffId: string, permissions: StaffPermissions, ip: string) {
    const gate = await this.access.principal(actor, 'members');
    const staff = await this.prisma.user.findUnique({ where: { id: staffId } });
    if (!staff || !staff.isStaff || staff.principalId !== gate.line.userId) {
      throw new DomainError('FORBIDDEN');
    }
    const next = pick(permissions);
    await this.prisma.user.update({ where: { id: staff.id }, data: { permissions: next } });
    await this.audit.append(this.prisma, {
      actorId: gate.actorId,
      action: 'STAFF_UPDATE',
      target: staff.id,
      detail: { permissions: next },
      ip,
    });
    return { id: staff.id, permissions: next };
  }
}

function pick(input: StaffPermissions): StaffPermissions {
  return {
    viewBalance: input.viewBalance,
    viewReports: input.viewReports,
    manageCredit: input.manageCredit,
    manageMembers: input.manageMembers,
  };
}

function newReferralCode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(7);
  let code = 's';
  for (const byte of bytes) {
    code += alphabet[byte % alphabet.length];
  }
  return code;
}

function isUnique(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002';
}

export type { RoleName };
