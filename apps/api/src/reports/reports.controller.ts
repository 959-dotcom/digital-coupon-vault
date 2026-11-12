import { Controller, Get, Query } from '@nestjs/common';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators.js';
import { ReportsService } from './reports.service.js';
import type { ReportPreset } from './report-window.js';

class ReportQueryDto {
  @IsIn(['today', '3', '7', '30', 'custom'])
  preset!: ReportPreset;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  sales(@CurrentUser() actor: AuthUser, @Query() query: ReportQueryDto) {
    return this.reports.sales(actor, query.preset, query.from, query.to);
  }
}
