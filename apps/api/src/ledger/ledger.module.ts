import { Module } from '@nestjs/common';
import { LedgerController } from './ledger.controller.js';
import { LedgerService } from './ledger.service.js';
import { WithdrawalController } from './withdrawal.controller.js';
import { WithdrawalService } from './withdrawal.service.js';

@Module({
  controllers: [LedgerController, WithdrawalController],
  providers: [LedgerService, WithdrawalService],
})
export class LedgerModule {}
