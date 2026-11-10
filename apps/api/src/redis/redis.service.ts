import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis | null;

  constructor(config: ConfigService) {
    const url = config.get<string>('REDIS_URL');
    this.client = url
      ? new Redis(url, {
          maxRetriesPerRequest: 2,
          enableReadyCheck: true,
        })
      : null;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit();
  }
}
