import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CommissionModule } from '../commission/commission.module.js';
import { CouponConfirmationService } from './coupon-confirmation.service.js';
import { CouponsController } from './coupons.controller.js';
import { CouponsService } from './coupons.service.js';
import { IngestionProcessor } from './ingestion.processor.js';
import { IngestionService } from './ingestion.service.js';

@Module({
  imports: [CommissionModule, BullModule.registerQueue({ name: 'coupon-ingestion' })],
  controllers: [CouponsController],
  providers: [CouponsService, CouponConfirmationService, IngestionProcessor, IngestionService],
})
export class CouponsModule {}
