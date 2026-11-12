import { Controller, Get, Param } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators.js';
import { BillService } from './bill.service.js';

class BillParamsDto {
  @IsUUID()
  id!: string;
}

@Controller('bills')
export class BillController {
  constructor(private readonly bills: BillService) {}

  @Get()
  list(@CurrentUser() actor: AuthUser) {
    return this.bills.list(actor);
  }

  @Get(':id')
  slice(@CurrentUser() actor: AuthUser, @Param() params: BillParamsDto) {
    return this.bills.slice(actor, params.id);
  }
}
