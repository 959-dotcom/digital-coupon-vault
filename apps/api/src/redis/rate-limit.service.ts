import { Injectable } from '@nestjs/common';
import { DomainError } from '../common/domain-error.js';
import { RedisService } from './redis.service.js';

@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  async hit(bucket: string, limit: number, windowSeconds: number): Promise<void> {
    const key = `rl:${bucket}`;
    const count = await this.redis.client.incr(key);
    if (count === 1) {
      await this.redis.client.expire(key, windowSeconds);
    }
    if (count > limit) {
      throw new DomainError('RATE_LIMITED');
    }
  }
}
