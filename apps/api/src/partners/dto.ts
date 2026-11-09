import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export const DISTRIBUTION_MODES = ['COMMISSION_ONLY', 'FULL_PASS', 'SPLIT_KEEP'] as const;

export class CreatePartnerDto {
  @Matches(/^[A-Za-z][A-Za-z0-9_]{0,62}$/)
  code!: string;

  @IsString()
  @Length(1, 120)
  name!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsIn(DISTRIBUTION_MODES)
  distributionMode!: (typeof DISTRIBUTION_MODES)[number];

  @IsObject()
  commissionRates!: Record<string, string>;
}

export class UpdatePartnerDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCommercialDto {
  @IsOptional()
  @IsIn(DISTRIBUTION_MODES)
  distributionMode?: (typeof DISTRIBUTION_MODES)[number];

  @IsOptional()
  @IsObject()
  commissionRates?: Record<string, string>;
}

export class PartnerParamsDto {
  @IsUUID()
  id!: string;
}

export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number;
}
