import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators.js';
import { ORDER_LIMIT, ORDER_TTL_MS } from '../redis/throttler-storage.js';
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
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: ORDER_LIMIT, ttl: ORDER_TTL_MS } })
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
