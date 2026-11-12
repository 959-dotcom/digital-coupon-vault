import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import bcrypt from 'bcrypt';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import {
  CommissionModeDto,
  CreateDownlineDto,
  HoldDto,
  ResetPasswordDto,
  SystemSettingDto,
  UpdateMemberDto,
  UserParamsDto,
} from './dto.js';
import { HierarchyService } from './hierarchy.service.js';

@Controller()
export class HierarchyController {
  constructor(private readonly hierarchy: HierarchyService) {}

  @Get('me/referral')
  referral(@CurrentUser() actor: AuthUser) {
    return this.hierarchy.referral(actor);
  }

  @Get('me/hold')
  hold(@CurrentUser() actor: AuthUser) {
    return this.hierarchy.holdBar(actor);
  }

  @Get('network')
  network(@CurrentUser() actor: AuthUser) {
    return this.hierarchy.line(actor);
  }

  @Post('network/downline')
  async downline(@CurrentUser() actor: AuthUser, @Body() dto: CreateDownlineDto, @Req() request: Request) {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.hierarchy.createDownline(
      actor,
      {
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
        commissionOnly: dto.commissionOnly,
        role: dto.role,
        holdPercent: dto.holdPercent,
        isActive: dto.isActive,
      },
      request.ip || 'unknown',
    );
  }

  @Patch('network/:id')
  updateMember(
    @CurrentUser() actor: AuthUser,
    @Param() params: UserParamsDto,
    @Body() dto: UpdateMemberDto,
    @Req() request: Request,
  ) {
    return this.hierarchy.updateMember(actor, params.id, dto, request.ip || 'unknown');
  }

  @Post('network/:id/password')
  async resetPassword(
    @CurrentUser() actor: AuthUser,
    @Param() params: UserParamsDto,
    @Body() dto: ResetPasswordDto,
    @Req() request: Request,
  ) {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const reset = await this.hierarchy.resetPassword(actor, params.id, passwordHash, request.ip || 'unknown');
    return { id: reset.id, password: dto.password };
  }

  @Patch('network/:id/hold')
  holdEdit(@CurrentUser() actor: AuthUser, @Param() params: UserParamsDto, @Body() dto: HoldDto) {
    return this.hierarchy.updateHold(actor, params.id, dto.holdPercent);
  }

  @Patch('network/:id/mode')
  mode(@CurrentUser() actor: AuthUser, @Param() params: UserParamsDto, @Body() dto: CommissionModeDto) {
    return this.hierarchy.updateMode(actor, params.id, dto.commissionOnly);
  }

  @Patch('system/settings')
  @Roles('SUPER_ADMIN')
  settings(@CurrentUser() actor: AuthUser, @Body() dto: SystemSettingDto) {
    return this.hierarchy.updateSettings(actor, dto.adminBasePercent, dto.percentLockMode);
  }
}
