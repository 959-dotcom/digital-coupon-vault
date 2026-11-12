import { Injectable } from '@nestjs/common';
import type { AuthUser, RoleName } from '../auth/auth-user.js';
import { DomainError } from '../common/domain-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { allows, readPermissions, type ReportScope, type StaffAction, type StaffPermissions } from './permissions.js';

export type LineGate = {
  line: AuthUser;
  actorId: string;
  isStaff: boolean;
  permissions: StaffPermissions | null;
  reportScope: 'all' | 'downline';
};

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async principal(actor: AuthUser, action: StaffAction): Promise<LineGate> {
    const gate = await this.load(actor);
    if (!gate.isStaff || !gate.permissions) {
      return gate;
    }
    if (!allows(gate.permissions, action)) {
      throw new DomainError('FORBIDDEN');
    }
    return gate;
  }

  async denyStaff(actor: AuthUser): Promise<void> {
    const gate = await this.load(actor);
    if (gate.isStaff) {
      throw new DomainError('FORBIDDEN');
    }
  }

  async viewLine(actor: AuthUser): Promise<LineGate & { showCredit: boolean }> {
    const gate = await this.load(actor);
    if (!gate.isStaff || !gate.permissions) {
      return { ...gate, showCredit: true };
    }
    const canSee =
      gate.permissions.viewBalance || gate.permissions.viewReports !== 'none' || gate.permissions.manageMembers;
    if (!canSee) {
      throw new DomainError('FORBIDDEN');
    }
    return { ...gate, showCredit: gate.permissions.viewBalance };
  }

  private async load(actor: AuthUser): Promise<LineGate> {
    const row = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      include: { principal: true },
    });
    if (!row || !row.isActive) {
      throw new DomainError('USER_INACTIVE');
    }
    if (!row.isStaff) {
      return {
        line: actor,
        actorId: actor.userId,
        isStaff: false,
        permissions: null,
        reportScope: 'all',
      };
    }
    const permissions = readPermissions(row.permissions);
    const principal = row.principal;
    if (!principal || !principal.isActive) {
      throw new DomainError('FORBIDDEN');
    }
    const line: AuthUser = {
      userId: principal.id,
      email: principal.email,
      role: principal.role as RoleName,
      partnerId: principal.partnerId,
    };
    const reportScope: Exclude<ReportScope, 'none'> = permissions.viewReports === 'downline' ? 'downline' : 'all';
    return {
      line,
      actorId: actor.userId,
      isStaff: true,
      permissions,
      reportScope,
    };
  }
}
