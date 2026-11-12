import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import bcrypt from 'bcrypt';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { CommissionModeDto, CreateDownlineDto, HoldDto, SystemSettingDto, UserParamsDto } from './dto.js';
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
  async downline(@CurrentUser() actor: AuthUser, @Body() dto: CreateDownlineDto) {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.hierarchy.createDownline(actor, {
      email: dto.email,
      passwordHash,
      displayName: dto.displayName,
      commissionOnly: dto.commissionOnly,
    });
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
