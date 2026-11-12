import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { RouteRateLimit, RouteRateLimitGuard } from '../redis/route-rate-limit.guard.js';
import { WITHDRAWAL_LIMIT, WITHDRAWAL_TTL_MS } from '../redis/throttler-storage.js';
import { CreateWithdrawalDto, WithdrawalIdDto } from './dto.js';
import { WithdrawalService } from './withdrawal.service.js';

@Controller()
export class WithdrawalController {
  constructor(private readonly withdrawals: WithdrawalService) {}

  @Post('me/withdrawals')
  @UseGuards(RouteRateLimitGuard)
  @RouteRateLimit(WITHDRAWAL_LIMIT, WITHDRAWAL_TTL_MS)
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateWithdrawalDto) {
    return this.withdrawals.create(actor, dto);
  }

  @Get('me/withdrawals')
  list(@CurrentUser() actor: AuthUser) {
    return this.withdrawals.list(actor);
  }

  @Get('me/cash')
  cash(@CurrentUser() actor: AuthUser) {
    return this.withdrawals.cashBalance(actor);
  }

  @Get('me/ledger')
  ledger(@CurrentUser() actor: AuthUser) {
    return this.withdrawals.ledger(actor);
  }

  @Get('admin/withdrawals')
  @Roles('SUPER_ADMIN')
  queue(@CurrentUser() actor: AuthUser) {
    return this.withdrawals.queue(actor);
  }

  @Post('admin/withdrawals/:id/approve')
  @Roles('SUPER_ADMIN')
  approve(@CurrentUser() actor: AuthUser, @Param() params: WithdrawalIdDto) {
    return this.withdrawals.approve(actor, params.id);
  }

  @Post('admin/withdrawals/:id/reject')
  @Roles('SUPER_ADMIN')
  reject(@CurrentUser() actor: AuthUser, @Param() params: WithdrawalIdDto) {
    return this.withdrawals.reject(actor, params.id);
  }
}
