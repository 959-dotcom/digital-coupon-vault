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

  async register(dto: { email: string; password: string; displayName: string; ref: string }) {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const created = await this.hierarchy.provision({
      email: dto.email,
      passwordHash,
      displayName: dto.displayName,
      commissionOnly: false,
      referralCode: dto.ref.trim(),
    });
    return { id: created.id, email: created.email, role: created.role };
  }

  async login(dto: LoginDto, ip: string): Promise<{ accessToken: string; user: AuthUser & { displayName: string; commissionOnly: boolean; isStaff: boolean; permissions: ReturnType<typeof readPermissions> | null } }> {
    await this.rateLimit.hit(`login:${ip}`, 10, 60);
    const email = dto.email.trim().toLowerCase();
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
