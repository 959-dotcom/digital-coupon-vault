import { Body, Controller, Get, Headers, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser, Public, Roles } from '../auth/decorators.js';
import { DepositService } from './deposit.service.js';
import { CreateDepositDto, DepositIdDto, MatchDepositDto, PaymentSettingsDto, SlipDto } from './dto.js';

@Controller()
export class DepositController {
  constructor(private readonly deposits: DepositService) {}

  @Get('deposits/config')
  config() {
    return this.deposits.config();
  }

  @Get('deposits')
  list(@CurrentUser() actor: AuthUser) {
    return this.deposits.list(actor);
  }

  @Post('deposits')
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateDepositDto) {
    return this.deposits.create(actor, dto.amount);
  }

  @Post('deposits/match')
  @Roles('SUPER_ADMIN')
  match(@CurrentUser() actor: AuthUser, @Body() dto: MatchDepositDto, @Req() request: Request) {
    return this.deposits.match(actor, dto.amount, dto.bankRef, request.ip || 'unknown');
  }

  @Get('deposits/:id')
  one(@CurrentUser() actor: AuthUser, @Param() params: DepositIdDto) {
    return this.deposits.one(actor, params.id);
  }

  @Post('deposits/:id/slip')
  slip(
    @CurrentUser() actor: AuthUser,
    @Param() params: DepositIdDto,
    @Body() dto: SlipDto,
    @Req() request: Request,
  ) {
    return this.deposits.attachSlip(actor, params.id, dto.filename, dto.contentBase64, request.ip || 'unknown');
  }

  @Get('system/payments')
  @Roles('SUPER_ADMIN')
  payments(@CurrentUser() actor: AuthUser) {
    return this.deposits.adminView(actor);
  }

  @Patch('system/payments')
  @Roles('SUPER_ADMIN')
  updatePayments(@CurrentUser() actor: AuthUser, @Body() dto: PaymentSettingsDto, @Req() request: Request) {
    return this.deposits.updateSettings(actor, dto, request.ip || 'unknown');
  }

  @Public()
  @Post('telegram/webhook')
  webhook(@Headers('x-telegram-bot-api-secret-token') secret: string | undefined, @Body() update: { update_id: number }) {
    return this.deposits.handleTelegram(secret, update);
  }
}
