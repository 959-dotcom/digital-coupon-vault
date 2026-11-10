import { Controller, Get, Headers } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/decorators.js';
import { YeekeeBatchScheduler } from '../coupons/yeekee-batch.scheduler.js';
import { DomainError } from '../common/domain-error.js';
import { NotificationService } from '../notifications/notification.service.js';
import { ExternalResultOracleService } from '../oracle/external-result-oracle.service.js';

@Controller()
export class CronController {
  constructor(
    private readonly config: ConfigService,
    private readonly yeekee: YeekeeBatchScheduler,
    private readonly oracle: ExternalResultOracleService,
    private readonly notifications: NotificationService,
  ) {}

  @Public()
  @Get('cron/batch')
  async run(@Headers('authorization') authorization?: string) {
    const secret = this.config.get<string>('CRON_SECRET');
    if (!secret || authorization !== `Bearer ${secret}`) {
      throw new DomainError('UNAUTHORIZED');
    }
    const now = new Date();
    await this.yeekee.sync(now);
    await this.oracle.poll(now);
    await this.notifications.remindUpcoming(now);
    return { ok: true, at: now.toISOString() };
  }
}
