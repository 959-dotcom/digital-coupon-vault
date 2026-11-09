import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CommissionModule } from '../commission/commission.module.js';
import { CouponCategoryController } from './coupon-category.controller.js';
import { CouponCategoryService } from './coupon-category.service.js';
import { CouponConfirmationService } from './coupon-confirmation.service.js';
import { CouponsController } from './coupons.controller.js';
import { CouponsService } from './coupons.service.js';
import { IngestionService } from './ingestion.service.js';

@Module({
  imports: [
    CommissionModule,
    BullModule.registerQueue({ name: 'coupon-ingestion' }),
  ],
  controllers: [CouponsController, CouponCategoryController],
  providers: [CouponsService, CouponCategoryService, CouponConfirmationService, IngestionService],
})
export class CouponsModule {}
