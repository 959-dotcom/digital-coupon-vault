import { Module } from '@nestjs/common';
import { CommissionEngineService } from './commission-engine.service.js';

@Module({
  providers: [CommissionEngineService],
  exports: [CommissionEngineService],
})
export class CommissionModule {}
