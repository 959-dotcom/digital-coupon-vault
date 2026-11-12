import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import { IsBoolean, IsString } from 'class-validator';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators.js';
import { ProductsService } from './products.service.js';

class ProductParamsDto {
  @IsString()
  code!: string;
}

class ProductToggleDto {
  @IsBoolean()
  isActive!: boolean;
}

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@CurrentUser() actor: AuthUser) {
    return this.products.list(actor);
  }

  @Patch(':code')
  set(
    @CurrentUser() actor: AuthUser,
    @Param() params: ProductParamsDto,
    @Body() dto: ProductToggleDto,
    @Req() request: Request,
  ) {
    return this.products.set(actor, params.code, dto.isActive, request.ip || 'unknown');
  }
}
