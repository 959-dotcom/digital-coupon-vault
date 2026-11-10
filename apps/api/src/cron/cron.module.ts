import { Module } from '@nestjs/common';
import { CouponCategoryService } from '../coupons/coupon-category.service.js';
import { YeekeeBatchScheduler } from '../coupons/yeekee-batch.scheduler.js';
import { ExternalResultOracleService } from '../oracle/external-result-oracle.service.js';
import { CronController } from './cron.controller.js';

@Module({
  controllers: [CronController],
  providers: [CouponCategoryService, YeekeeBatchScheduler, ExternalResultOracleService],
})
export class CronModule {}
