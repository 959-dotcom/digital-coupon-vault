import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators.js';
import { CategoryParamsDto, CreateOrderDto } from './dto.js';
import { CouponsService } from './coupons.service.js';

@Controller()
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get('coupons/categories')
  categories() {
    return this.coupons.listCategories();
  }

  @Get('coupons/categories/:id')
  category(@Param() params: CategoryParamsDto) {
    return this.coupons.getCategory(params.id);
  }

  @Post('coupons/orders')
  order(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.coupons.placeOrder(actor, dto, idempotencyKey);
  }

  @Get('me/transactions')
  transactions(@CurrentUser() actor: AuthUser) {
    return this.coupons.myTransactions(actor);
  }

  @Get('me/balance')
  balance(@CurrentUser() actor: AuthUser) {
    return this.coupons.myBalance(actor);
  }
}
