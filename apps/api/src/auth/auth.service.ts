import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
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
  ) {}

  async login(dto: LoginDto, ip: string): Promise<{ accessToken: string; user: AuthUser & { displayName: string } }> {
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
    return { accessToken, user: { ...authUser, displayName: user.displayName } };
  }
}
