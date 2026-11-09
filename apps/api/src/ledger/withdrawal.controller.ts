import { Body, Controller, Get, Post } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators.js';
import { CreateWithdrawalDto } from './dto.js';
import { WithdrawalService } from './withdrawal.service.js';

@Controller()
export class WithdrawalController {
  constructor(private readonly withdrawals: WithdrawalService) {}

  @Post('me/withdrawals')
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateWithdrawalDto) {
    return this.withdrawals.create(actor, dto);
  }

  @Get('me/withdrawals')
  list(@CurrentUser() actor: AuthUser) {
    return this.withdrawals.list(actor);
  }

  @Get('me/ledger')
  ledger(@CurrentUser() actor: AuthUser) {
    return this.withdrawals.ledger(actor);
  }
}
