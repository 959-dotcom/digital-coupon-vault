import { Body, Controller, Post } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { CreditAmountDto, CreditTransferDto } from './dto.js';
import { CreditService } from './credit.service.js';

@Controller('credit')
export class CreditController {
  constructor(private readonly credit: CreditService) {}

  @Post('mint')
  @Roles('SUPER_ADMIN')
  mint(@CurrentUser() actor: AuthUser, @Body() dto: CreditAmountDto) {
    return this.credit.mint(actor, dto.amount);
  }

  @Post('burn')
  @Roles('SUPER_ADMIN')
  burn(@CurrentUser() actor: AuthUser, @Body() dto: CreditAmountDto) {
    return this.credit.burn(actor, dto.amount);
  }

  @Post('transfer')
  transfer(@CurrentUser() actor: AuthUser, @Body() dto: CreditTransferDto) {
    return this.credit.transfer(actor, dto.receiverId, dto.amount);
  }
}
