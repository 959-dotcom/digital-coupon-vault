import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CommissionModule } from '../commission/commission.module.js';
import { IngestionProcessor } from '../coupons/ingestion.processor.js';
import { CouponConfirmationService } from '../coupons/coupon-confirmation.service.js';
import { YeekeeBatchProcessor } from '../coupons/yeekee-batch.processor.js';
import { YeekeeBatchScheduler } from '../coupons/yeekee-batch.scheduler.js';
import { NotificationModule } from '../notifications/notification.module.js';
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
    VaultModule,
    CommissionModule,
    NotificationModule,
    BullModule.registerQueue({ name: 'coupon-ingestion' }),
    BullModule.registerQueue({ name: 'yeekee-batches' }),
    BullModule.registerQueue({ name: 'batch-notifications' }),
  ],
  providers: [
    CouponConfirmationService,
    IngestionProcessor,
    YeekeeBatchScheduler,
    YeekeeBatchProcessor,
    NotificationProcessor,
    BatchJobScheduler,
  ],
})
export class WorkerModule {}
