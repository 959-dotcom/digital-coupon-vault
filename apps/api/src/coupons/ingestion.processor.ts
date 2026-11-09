import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { DomainError } from '../common/domain-error.js';
import { CouponConfirmationService } from './coupon-confirmation.service.js';
import type { ConfirmOrderJob, OrderReceipt } from './dto.js';

@Processor('coupon-ingestion')
export class IngestionProcessor extends WorkerHost {
  constructor(private readonly confirmation: CouponConfirmationService) {
    super();
  }

  async process(job: Job<ConfirmOrderJob>): Promise<OrderReceipt> {
    try {
      return await this.confirmation.confirm(job.data);
    } catch (error) {
      if (error instanceof DomainError && error.code !== 'WALLET_BUSY') {
        throw new UnrecoverableError(error.code);
      }
      throw error;
    }
  }
}
