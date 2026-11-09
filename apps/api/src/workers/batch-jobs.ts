import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class BatchJobScheduler implements OnModuleInit {
  constructor(@InjectQueue('batch-notifications') private readonly notifications: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.notifications.upsertJobScheduler(
      'notifications-minute',
      { pattern: '* * * * *' },
      { name: 'remind', data: {} },
    );
  }
}
