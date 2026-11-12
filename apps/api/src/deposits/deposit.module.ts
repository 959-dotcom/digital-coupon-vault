import { Module } from '@nestjs/common';
import { DepositController } from './deposit.controller.js';
import { DepositService } from './deposit.service.js';

@Module({
  controllers: [DepositController],
  providers: [DepositService],
  exports: [DepositService],
})
export class DepositModule {}