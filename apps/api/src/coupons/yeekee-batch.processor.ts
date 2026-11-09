import { Processor, WorkerHost } from '@nestjs/bullmq';
import { YeekeeBatchScheduler } from './yeekee-batch.scheduler.js';

@Processor('yeekee-batches')
export class YeekeeBatchProcessor extends WorkerHost {
  constructor(private readonly scheduler: YeekeeBatchScheduler) {
    super();
  }

  async process(): Promise<void> {
    await this.scheduler.sync(new Date());
  }
}
