import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, QueueEvents } from 'bullmq';
import { asDomainError, DomainError, KNOWN_ERROR_CODES } from '../common/domain-error.js';
import type { ConfirmOrderJob, OrderReceipt } from './dto.js';
import { CouponConfirmationService } from './coupon-confirmation.service.js';

@Injectable()
export class IngestionService implements OnModuleDestroy {
  private readonly events: QueueEvents | null;

  constructor(
    private readonly confirmation: CouponConfirmationService,
    config: ConfigService,
    @Optional() @InjectQueue('coupon-ingestion') private readonly queue?: Queue<ConfirmOrderJob>,
  ) {
    const redisUrl = config.get<string>('REDIS_URL');
    this.events = this.queue && redisUrl ? new QueueEvents('coupon-ingestion', { connection: { url: redisUrl } }) : null;
  }

  async onModuleDestroy(): Promise<void> {
    await this.events?.close();
  }

  async enqueueAndWait(data: ConfirmOrderJob): Promise<OrderReceipt> {
    if (!this.queue || !this.events) {
      return this.confirmation.confirm(data);
    }
    const existing = await this.queue.getJob(data.idempotencyKey);
    if (existing) {
      const state = await existing.getState();
      if (state === 'completed') {
        return existing.returnvalue as OrderReceipt;
      }
      if (state === 'failed') {
        const domain = codeFrom(existing.failedReason);
        if (domain && domain.code !== 'WALLET_BUSY') {
          throw domain;
        }
        await existing.remove();
      } else {
        return this.wait(existing);
      }
    }
    const job = await this.queue.add('confirm', data, {
      jobId: data.idempotencyKey,
      removeOnComplete: { age: 86_400, count: 1_000 },
      removeOnFail: { age: 86_400, count: 1_000 },
      attempts: 3,
      backoff: { type: 'exponential', delay: 200 },
    });
    return this.wait(job);
  }

  private async wait(job: Job<ConfirmOrderJob>): Promise<OrderReceipt> {
    if (!this.events) {
      return this.confirmation.confirm(job.data);
    }
    try {
      return (await job.waitUntilFinished(this.events, 20_000)) as OrderReceipt;
    } catch (error) {
      const domain = asDomainError(error) ?? codeFrom(error instanceof Error ? error.message : String(error));
      if (domain) {
        throw domain;
      }
      throw error;
    }
  }
}

function codeFrom(text: string | undefined): DomainError | null {
  if (!text) {
    return null;
  }
  const found = KNOWN_ERROR_CODES.find((code) => text.includes(code));
  return found ? new DomainError(found) : null;
}
