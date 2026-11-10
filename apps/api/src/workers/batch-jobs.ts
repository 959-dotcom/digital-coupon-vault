import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { YeekeeBatchScheduler } from '../coupons/yeekee-batch.scheduler.js';

@Injectable()
export class BatchJobScheduler implements OnModuleInit {
  constructor(
    @InjectQueue('batch-notifications') private readonly notifications: Queue,
    @InjectQueue('yeekee-batches') private readonly yeekee: Queue,
    @InjectQueue('result-oracle') private readonly oracle: Queue,
    private readonly yeekeeScheduler: YeekeeBatchScheduler,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.notifications.upsertJobScheduler(
      'notifications-minute',
      { pattern: '* * * * *' },
      { name: 'remind', data: {} },
    );
    await this.yeekee.upsertJobScheduler('yeekee-15m', { pattern: '* * * * *' }, { name: 'sync', data: {} });
    await this.oracle.upsertJobScheduler('result-oracle-minute', { pattern: '* * * * *' }, { name: 'poll', data: {} });
    await this.yeekeeScheduler.sync(new Date());
  }
}
