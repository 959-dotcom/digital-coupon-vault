import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { CreatePartnerDto, PartnerParamsDto, UpdateCommercialDto, UpdatePartnerDto } from './dto.js';
import { PartnersService } from './partners.service.js';

@Controller('partners')
export class PartnersController {
  constructor(private readonly partners: PartnersService) {}

  @Get('hierarchy')
  @Roles('SUPER_ADMIN', 'MASTER_PARTNER', 'PARTNER')
  hierarchy(@CurrentUser() actor: AuthUser) {
    return this.partners.hierarchy(actor);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'MASTER_PARTNER', 'PARTNER')
  list(@CurrentUser() actor: AuthUser) {
    return this.partners.list(actor);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'MASTER_PARTNER', 'PARTNER')
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreatePartnerDto) {
    return this.partners.create(actor, dto);
  }

  @Patch(':id/commercial')
  @Roles('SUPER_ADMIN', 'MASTER_PARTNER')
  commercial(@CurrentUser() actor: AuthUser, @Param() params: PartnerParamsDto, @Body() dto: UpdateCommercialDto) {
    return this.partners.updateCommercial(actor, params.id, dto);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'MASTER_PARTNER', 'PARTNER')
  get(@CurrentUser() actor: AuthUser, @Param() params: PartnerParamsDto) {
    return this.partners.get(actor, params.id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'MASTER_PARTNER', 'PARTNER')
  update(@CurrentUser() actor: AuthUser, @Param() params: PartnerParamsDto, @Body() dto: UpdatePartnerDto) {
    return this.partners.update(actor, params.id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'MASTER_PARTNER')
  remove(@CurrentUser() actor: AuthUser, @Param() params: PartnerParamsDto) {
    return this.partners.remove(actor, params.id);
  }
}
