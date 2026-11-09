import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, QueueEvents } from 'bullmq';
import { asDomainError, DomainError, KNOWN_ERROR_CODES } from '../common/domain-error.js';
import type { ConfirmOrderJob, OrderReceipt } from './dto.js';

@Injectable()
export class IngestionService implements OnModuleDestroy {
  private readonly events: QueueEvents;

  constructor(
    @InjectQueue('coupon-ingestion') private readonly queue: Queue<ConfirmOrderJob>,
    config: ConfigService,
  ) {
    this.events = new QueueEvents('coupon-ingestion', {
      connection: { url: config.getOrThrow<string>('REDIS_URL') },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.events.close();
  }

  async enqueueAndWait(data: ConfirmOrderJob): Promise<OrderReceipt> {
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
