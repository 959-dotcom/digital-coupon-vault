import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ExternalResultOracleService } from './external-result-oracle.service.js';

@Processor('result-oracle')
export class ExternalResultOracleProcessor extends WorkerHost {
  constructor(private readonly oracle: ExternalResultOracleService) {
    super();
  }

  async process(): Promise<void> {
    await this.oracle.poll(new Date());
  }
}
