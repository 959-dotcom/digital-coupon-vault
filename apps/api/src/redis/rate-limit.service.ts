import { Injectable } from '@nestjs/common';
import { DomainError } from '../common/domain-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DatabaseThrottlerStorage } from './database-rate-limit.js';
import { RedisService } from './redis.service.js';

@Injectable()
export class RateLimitService {
  private readonly database: DatabaseThrottlerStorage;

  constructor(
    private readonly redis: RedisService,
    prisma: PrismaService,
  ) {
    this.database = new DatabaseThrottlerStorage(prisma);
  }

  async hit(bucket: string, limit: number, windowSeconds: number): Promise<void> {
    const key = `rl:${bucket}`;
    if (this.redis.client) {
      const count = await this.redis.client.incr(key);
      if (count === 1) {
        await this.redis.client.expire(key, windowSeconds);
      }
      if (count > limit) {
        throw new DomainError('RATE_LIMITED');
      }
      return;
    }
    const record = await this.database.increment(key, windowSeconds * 1000, limit, 0, 'default');
    if (record.isBlocked) {
      throw new DomainError('RATE_LIMITED');
    }
  }
}
