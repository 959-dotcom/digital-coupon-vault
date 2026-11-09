import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators.js';
import { CategoryParamsDto, SettleBatchDto } from './dto.js';
import { CouponCategoryService } from './coupon-category.service.js';

@Controller('api/v1')
export class CouponCategoryController {
  constructor(private readonly categories: CouponCategoryService) {}

  @Get('categories')
  list() {
    return this.categories.list();
  }

  @Get('categories/:id')
  get(@Param() params: CategoryParamsDto) {
    return this.categories.get(params.id);
  }

  @Post('admin/batches/settle')
  @Roles('SUPER_ADMIN')
  settle(@Body() dto: SettleBatchDto) {
    return this.categories.settle(dto);
  }
}
