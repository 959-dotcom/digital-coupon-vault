import './load-env.js';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AccessModule } from './access/access.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { RolesGuard } from './auth/roles.guard.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { CommissionModule } from './commission/commission.module.js';
import { CouponsModule } from './coupons/coupons.module.js';
import { CronModule } from './cron/cron.module.js';
import { HealthController } from './health.controller.js';
import { HmacGuard } from './hmac/hmac.guard.js';
import { BillModule } from './bills/bill.module.js';
import { CreditModule } from './credit/credit.module.js';
import { DepositModule } from './deposits/deposit.module.js';
import { HierarchyModule } from './hierarchy/hierarchy.module.js';
import { LedgerModule } from './ledger/ledger.module.js';
import { ProductsModule } from './products/products.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { StaffModule } from './staff/staff.module.js';
import { PartnersModule } from './partners/partners.module.js';
import { NotificationModule } from './notifications/notification.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';
import { VaultModule } from './vault/vault.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ...(process.env.REDIS_URL
      ? [BullModule.forRoot({ connection: { url: process.env.REDIS_URL } })]
      : []),
    PrismaModule,
    RedisModule,
    AuditModule,
    AccessModule,
    NotificationModule,
    VaultModule,
    AuthModule,
    HierarchyModule,
    CreditModule,
    DepositModule,
    BillModule,
    ProductsModule,
    ReportsModule,
    StaffModule,
    CommissionModule,
    PartnersModule,
    CouponsModule,
    CronModule,
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
