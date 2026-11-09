import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { PageQueryDto } from '../partners/dto.js';
import { FundPointsDto } from './dto.js';
import { LedgerService } from './ledger.service.js';

@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get('audit')
  audit(@CurrentUser() actor: AuthUser, @Query() query: PageQueryDto) {
    return this.ledger.audit(actor, Number(query.page ?? 1), Number(query.pageSize ?? 20));
  }

  @Post('funding')
  @Roles('SUPER_ADMIN')
  fund(@CurrentUser() actor: AuthUser, @Body() dto: FundPointsDto) {
    return this.ledger.fund(actor, dto);
  }
}
