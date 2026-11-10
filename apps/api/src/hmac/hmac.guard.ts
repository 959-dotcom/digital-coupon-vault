import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { DomainError } from '../common/domain-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

const WINDOW_MS = 60_000;
const NONCE_TTL_SECONDS = 120;

@Injectable()
export class HmacGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();
    const method = request.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return true;
    }

    const timestamp = header(request, 'x-timestamp');
    const nonce = header(request, 'x-nonce');
    const signature = header(request, 'x-signature');
    if (!timestamp || !nonce || !signature) {
      throw new DomainError('HMAC_INVALID');
    }
    if (!/^\d{12,13}$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > WINDOW_MS) {
      throw new DomainError('HMAC_EXPIRED');
    }
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) {
      throw new DomainError('HMAC_INVALID');
    }
    if (!/^[0-9a-f]{64}$/i.test(signature)) {
      throw new DomainError('HMAC_INVALID');
    }

    const reserved = this.redis.client
      ? await this.redis.client.set(`hmac:nonce:${nonce}`, '1', 'EX', NONCE_TTL_SECONDS, 'NX')
      : await this.reserveNonce(nonce);
    if (reserved !== 'OK') {
      throw new DomainError('HMAC_NONCE_REUSED');
    }

    const rawBody = request.rawBody ? request.rawBody.toString('utf8') : '';
    const payload = `${method}|${request.path}|${timestamp}|${nonce}|${rawBody}`;
    const expected = createHmac('sha256', this.config.getOrThrow<string>('HMAC_SECRET')).update(payload).digest('hex');
    const valid = timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
    if (!valid) {
      throw new DomainError('HMAC_INVALID');
    }
    return true;
  }

  private async reserveNonce(nonce: string): Promise<'OK' | null> {
    await this.prisma.$executeRaw`DELETE FROM "RequestNonce" WHERE "expiresAt" < NOW()`;
    const inserted = await this.prisma.$queryRaw<Array<{ nonce: string }>>`
      INSERT INTO "RequestNonce" (nonce, "expiresAt")
      VALUES (${nonce}, NOW() + (${NONCE_TTL_SECONDS}::int * INTERVAL '1 second'))
      ON CONFLICT (nonce) DO NOTHING
      RETURNING nonce
    `;
    return inserted.length === 1 ? 'OK' : null;
  }
}

function header(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === 'string' ? value : undefined;
}
