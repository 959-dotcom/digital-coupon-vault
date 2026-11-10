import { Global, Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service.js';
import { RedisService } from './redis.service.js';
import { RouteRateLimitGuard } from './route-rate-limit.guard.js';
import { WalletService } from './wallet.service.js';

@Global()
@Module({
  providers: [RedisService, RateLimitService, RouteRateLimitGuard, WalletService],
  exports: [RedisService, RateLimitService, RouteRateLimitGuard, WalletService],
})
export class RedisModule {}
