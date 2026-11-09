import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { RolesGuard } from './auth/roles.guard.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { CommissionModule } from './commission/commission.module.js';
import { CouponsModule } from './coupons/coupons.module.js';
import { HealthController } from './health.controller.js';
import { HmacGuard } from './hmac/hmac.guard.js';
import { LedgerModule } from './ledger/ledger.module.js';
import { PartnersModule } from './partners/partners.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';
import { VaultModule } from './vault/vault.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.getOrThrow<string>('REDIS_URL') },
      }),
    }),
    PrismaModule,
    RedisModule,
    VaultModule,
    AuthModule,
    CommissionModule,
    PartnersModule,
    CouponsModule,
    LedgerModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: HmacGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
