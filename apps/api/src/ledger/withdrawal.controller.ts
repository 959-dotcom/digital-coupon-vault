import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators.js';
import { WITHDRAWAL_LIMIT, WITHDRAWAL_TTL_MS } from '../redis/throttler-storage.js';
import { CreateWithdrawalDto } from './dto.js';
import { WithdrawalService } from './withdrawal.service.js';

@Controller()
export class WithdrawalController {
  constructor(private readonly withdrawals: WithdrawalService) {}

  @Post('me/withdrawals')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: WITHDRAWAL_LIMIT, ttl: WITHDRAWAL_TTL_MS } })
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
