import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuditModule } from '../audit/audit.module.js';
import { CommissionModule } from '../commission/commission.module.js';
import { IngestionProcessor } from '../coupons/ingestion.processor.js';
import { CouponCategoryService } from '../coupons/coupon-category.service.js';
import { CouponConfirmationService } from '../coupons/coupon-confirmation.service.js';
import { YeekeeBatchProcessor } from '../coupons/yeekee-batch.processor.js';
import { YeekeeBatchScheduler } from '../coupons/yeekee-batch.scheduler.js';
import { NotificationModule } from '../notifications/notification.module.js';
import { ExternalResultOracleProcessor } from '../oracle/external-result-oracle.processor.js';
import { ExternalResultOracleService } from '../oracle/external-result-oracle.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { VaultModule } from '../vault/vault.module.js';
import { BatchJobScheduler } from './batch-jobs.js';
import { NotificationProcessor } from './notification.processor.js';

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
    AuditModule,
    VaultModule,
    CommissionModule,
    NotificationModule,
    BullModule.registerQueue({ name: 'coupon-ingestion' }),
    BullModule.registerQueue({ name: 'yeekee-batches' }),
    BullModule.registerQueue({ name: 'batch-notifications' }),
    BullModule.registerQueue({ name: 'result-oracle' }),
  ],
  providers: [
    CouponCategoryService,
    CouponConfirmationService,
    IngestionProcessor,
    YeekeeBatchScheduler,
    YeekeeBatchProcessor,
    ExternalResultOracleService,
    ExternalResultOracleProcessor,
    NotificationProcessor,
    BatchJobScheduler,
  ],
})
export class WorkerModule {}
