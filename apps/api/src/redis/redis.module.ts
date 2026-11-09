import { Global, Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service.js';
import { RedisService } from './redis.service.js';
import { WalletService } from './wallet.service.js';

@Global()
@Module({
  providers: [RedisService, RateLimitService, WalletService],
  exports: [RedisService, RateLimitService, WalletService],
})
export class RedisModule {}
