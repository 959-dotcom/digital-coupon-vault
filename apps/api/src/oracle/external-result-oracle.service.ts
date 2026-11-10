import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CouponCategoryService } from '../coupons/coupon-category.service.js';
import { cutoffForSlot, parseSchedule } from '../coupons/schedule.js';
import { cutoffInstant } from '../cutoff/cutoff.js';
import { DomainError } from '../common/domain-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseOracleBody, parseOracleSourceUrls, sourceHost, type OracleReading } from './oracle-parse.js';

@Injectable()
export class ExternalResultOracleService {
  private readonly logger = new Logger(ExternalResultOracleService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly categories: CouponCategoryService,
  ) {}

  async poll(now: Date): Promise<void> {
    const urls = parseOracleSourceUrls(this.config.get<string>('ORACLE_SOURCE_URLS'));
    if (urls.length === 0) {
      this.logger.log('ORACLE_SOURCE_URLS is empty; oracle job no-op');
      return;
    }
    for (const url of urls) {
      const reading = await this.readSource(url);
      if (!reading || !reading.verified || reading.categoryCode === 'YEEKEE_15M') {
        continue;
      }
      try {
        await this.settleReading(reading, now, sourceHost(url));
      } catch (error) {
        if (error instanceof DomainError && error.code === 'BATCH_SETTLED') {
          continue;
        }
        this.logger.error(`oracle settlement failed for ${sourceHost(url)}`);
      }
    }
  }

  private async readSource(url: string): Promise<OracleReading | null> {
    const host = sourceHost(url);
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(8_000),
        headers: { accept: 'application/json, text/html;q=0.9' },
      });
    } catch {
      this.logger.warn(`oracle source unreachable: ${host}`);
      return null;
    }
    if (!response.ok) {
      this.logger.warn(`oracle source status ${response.status} from ${host}`);
      return null;
    }
    const body = await response.text();
    return parseOracleBody(body, response.headers.get('content-type') ?? '');
  }

  private async settleReading(reading: OracleReading, now: Date, host: string): Promise<void> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reading.batchDate)) {
      return;
    }
    const batch = await this.prisma.couponBatch.findFirst({
      where: {
        slot: reading.slot,
        batchDate: new Date(`${reading.batchDate}T00:00:00.000Z`),
        settledAt: null,
        category: { code: reading.categoryCode, isActive: true },
      },
      include: { category: true },
    });
    if (!batch) {
      return;
    }
    const schedule = parseSchedule(batch.category.schedule);
    const cutoff = cutoffInstant(batch.batchDate, cutoffForSlot(schedule, batch.category.cutoffTime, batch.slot));
    if (now.getTime() < cutoff.getTime()) {
      return;
    }
    await this.categories.settleVerified({
      batchId: batch.id,
      top3: reading.top3,
      bottom2: reading.bottom2,
      actorId: null,
      action: 'ORACLE_SETTLEMENT',
      detail: {
        source: 'oracle',
        sourceHost: host,
        categoryCode: reading.categoryCode,
      },
    });
  }
}
