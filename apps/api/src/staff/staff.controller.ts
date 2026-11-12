import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators.js';
import { CreateStaffDto, StaffParamsDto, UpdateStaffDto } from './dto.js';
import { StaffService } from './staff.service.js';

@Controller('staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  list(@CurrentUser() actor: AuthUser) {
    return this.staff.list(actor);
  }

  @Post()
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateStaffDto, @Req() request: Request) {
    return this.staff.create(actor, dto, request.ip || 'unknown');
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: AuthUser,
    @Param() params: StaffParamsDto,
    @Body() dto: UpdateStaffDto,
    @Req() request: Request,
  ) {
    return this.staff.update(actor, params.id, dto, request.ip || 'unknown');
  }
}
