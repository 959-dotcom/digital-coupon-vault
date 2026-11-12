import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { AuditLogService } from '../audit/audit-log.service.js';
import { readPermissions } from '../access/permissions.js';
import { HierarchyService } from '../hierarchy/hierarchy.service.js';
import { DomainError } from '../common/domain-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RateLimitService } from '../redis/rate-limit.service.js';
import type { AuthUser, RoleName } from './auth-user.js';
import type { LoginDto } from './dto.js';
import { assertPinPair, assertRegistration } from './registration.js';

const DUMMY_HASH = bcrypt.hashSync('vantage-dummy-timing', 12);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly rateLimit: RateLimitService,
    private readonly audit: AuditLogService,
    private readonly hierarchy: HierarchyService,
  ) {}

  async register(dto: {
    phone: string;
    pin: string;
    pinConfirm: string;
    bankProvider: string;
    accountNumber: string;
    fullName: string;
    lineId?: string;
    sourceChannel: string;
    ref?: string;
  }) {
    const parsed = assertRegistration(dto);
    const pinHash = await bcrypt.hash(parsed.pin, 12);
    const referral = dto.ref?.trim() ?? '';
    const admin = referral
      ? null
      : await this.prisma.user.findFirst({ where: { role: 'SUPER_ADMIN', isStaff: false, isActive: true }, select: { id: true } });
    if (!referral && !admin) {
      throw new DomainError('INVALID_REF');
    }
    const created = await this.hierarchy.provision({
      email: `${parsed.phone}@members.vantage.local`,
      passwordHash: DUMMY_HASH,
      displayName: parsed.fullName,
      commissionOnly: false,
      referralCode: referral || undefined,
      parentId: referral ? undefined : admin?.id,
      role: referral ? undefined : 'MEMBER',
      phone: parsed.phone,
      pinHash,
      bankProvider: parsed.bank,
      bankAccountNo: parsed.account,
      accountName: parsed.fullName,
      lineId: parsed.lineId,
      sourceChannel: parsed.source,
    });
    return { id: created.id, phone: parsed.phone, role: created.role };
  }

  async changePassword(actor: AuthUser, currentPassword: string, newPassword: string, ip: string): Promise<{ changed: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: actor.userId } });
    if (!user || !user.isActive) {
      throw new DomainError('USER_INACTIVE');
    }
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new DomainError('INVALID_CREDENTIALS');
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await this.audit.append(this.prisma, {
      actorId: user.id,
      action: 'PASSWORD_CHANGE',
      target: user.id,
      detail: { userId: user.id },
      ip,
    });
    return { changed: true };
  }

  async profile(actor: AuthUser) {
    const user = await this.prisma.user.findUnique({ where: { id: actor.userId } });
    if (!user || !user.isActive) {
      throw new DomainError('USER_INACTIVE');
    }
    return {
      displayName: user.displayName,
      phone: user.phone,
      bankProvider: user.bankProvider,
      bankAccountNo: user.bankAccountNo,
      accountName: user.accountName ?? user.displayName,
      lineId: user.lineId,
      sourceChannel: user.sourceChannel,
      hasPin: Boolean(user.pinHash),
      role: user.role,
      isStaff: user.isStaff,
    };
  }

  async changePin(actor: AuthUser, currentPin: string | undefined, pin: string, pinConfirm: string, ip: string): Promise<{ changed: true }> {
    const next = assertPinPair(pin, pinConfirm);
    const user = await this.prisma.user.findUnique({ where: { id: actor.userId } });
    if (!user || !user.isActive) {
      throw new DomainError('USER_INACTIVE');
    }
    if (user.pinHash) {
      const matches = currentPin ? await bcrypt.compare(currentPin, user.pinHash) : false;
      if (!matches) {
        throw new DomainError('BAD_PIN');
      }
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { pinHash: await bcrypt.hash(next, 12) } });
    await this.audit.append(this.prisma, {
      actorId: user.id,
      action: 'PIN_CHANGE',
      target: user.id,
      detail: { userId: user.id },
      ip,
    });
    return { changed: true };
  }

  private async loginWithPin(phone: string, pin: string, ip: string) {
    if (!/^\d{6}$/.test(pin)) {
      throw new DomainError('INVALID_CREDENTIALS');
    }
    const user = await this.prisma.user.findUnique({ where: { phone } });
    const hash = user?.pinHash ?? DUMMY_HASH;
    const matches = await bcrypt.compare(pin, hash);
    if (!user || !user.isActive || !user.pinHash || !matches) {
      throw new DomainError('INVALID_CREDENTIALS');
    }
    return this.issue(user, ip);
  }

  private async issue(
    user: { id: string; email: string; role: string; partnerId: string | null; displayName: string; commissionOnly: boolean; isStaff: boolean; permissions: unknown },
    ip: string,
  ) {
    const authUser: AuthUser = {
      userId: user.id,
      email: user.email,
      role: user.role as RoleName,
      partnerId: user.partnerId,
    };
    const accessToken = await this.jwt.signAsync({
      sub: authUser.userId,
      email: authUser.email,
      role: authUser.role,
      partnerId: authUser.partnerId,
    });
    if (authUser.role === 'SUPER_ADMIN' || user.isStaff) {
      await this.audit.append(this.prisma, {
        actorId: authUser.userId,
        action: user.isStaff ? 'STAFF_LOGIN' : 'ADMIN_LOGIN',
        target: authUser.userId,
        detail: { email: authUser.email },
        ip,
      });
    }
    return {
      accessToken,
      user: {
        ...authUser,
        displayName: user.displayName,
        commissionOnly: user.commissionOnly,
        isStaff: user.isStaff,
        permissions: user.isStaff ? readPermissions(user.permissions) : null,
      },
    };
  }

  async login(dto: LoginDto, ip: string): Promise<{ accessToken: string; user: AuthUser & { displayName: string; commissionOnly: boolean; isStaff: boolean; permissions: ReturnType<typeof readPermissions> | null } }> {
    await this.rateLimit.hit(`login:${ip}`, 10, 60);
    const identifier = dto.email.trim();
    if (/^0\d{9}$/.test(identifier)) {
      return this.loginWithPin(identifier, dto.password, ip);
    }
    if (dto.password.length < 8) {
      throw new DomainError('INVALID_CREDENTIALS');
    }
    const email = identifier.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const hash = user?.passwordHash ?? DUMMY_HASH;
    const matches = await bcrypt.compare(dto.password, hash);
    if (!user || !user.isActive || !matches) {
      throw new DomainError('INVALID_CREDENTIALS');
    }
    const authUser: AuthUser = {
      userId: user.id,
      email: user.email,
      role: user.role as RoleName,
      partnerId: user.partnerId,
    };
    const accessToken = await this.jwt.signAsync({
      sub: authUser.userId,
      email: authUser.email,
      role: authUser.role,
      partnerId: authUser.partnerId,
    });
    if (authUser.role === 'SUPER_ADMIN' || user.isStaff) {
      await this.audit.append(this.prisma, {
        actorId: authUser.userId,
        action: user.isStaff ? 'STAFF_LOGIN' : 'ADMIN_LOGIN',
        target: authUser.userId,
        detail: { email: authUser.email },
        ip,
      });
    }
    return {
      accessToken,
      user: {
        ...authUser,
        displayName: user.displayName,
        commissionOnly: user.commissionOnly,
        isStaff: user.isStaff,
        permissions: user.isStaff ? readPermissions(user.permissions) : null,
      },
    };
  }
}
