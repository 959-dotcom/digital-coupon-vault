import { Module } from '@nestjs/common';
import { BillController } from './bill.controller.js';
import { BillService } from './bill.service.js';

@Module({
  controllers: [BillController],
  providers: [BillService],
})
export class BillModule {}
