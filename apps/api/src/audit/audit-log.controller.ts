import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { AuditLogService } from './audit-log.service.js';

class AuditQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number;
}

@Controller('admin/audit-logs')
export class AuditLogController {
  constructor(private readonly audit: AuditLogService) {}

  @Get()
  @Roles('SUPER_ADMIN')
  search(@CurrentUser() actor: AuthUser, @Query() query: AuditQueryDto) {
    return this.audit.search(actor, query.q ?? '', Number(query.page ?? 1));
  }
}
