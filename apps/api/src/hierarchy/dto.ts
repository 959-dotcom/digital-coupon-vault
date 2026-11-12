import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { RoleName } from '../auth/auth-user.js';

export class CreateDownlineDto {
  @IsEmail()
  @MaxLength(180)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName!: string;

  @IsBoolean()
  commissionOnly!: boolean;

  @IsOptional()
  @IsIn(['MASTER_PARTNER', 'PARTNER', 'MEMBER'])
  role?: Exclude<RoleName, 'SUPER_ADMIN'>;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  holdPercent?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsIn(['MASTER_PARTNER', 'PARTNER', 'MEMBER'])
  role?: Exclude<RoleName, 'SUPER_ADMIN'>;

  @IsOptional()
  @IsBoolean()
  commissionOnly?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  holdPercent?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}

export class HoldDto {
  @IsString()
  @MaxLength(8)
  holdPercent!: string;
}

export class CommissionModeDto {
  @IsBoolean()
  commissionOnly!: boolean;
}

export class SystemSettingDto {
  @IsString()
  @MaxLength(8)
  adminBasePercent!: string;

  @IsIn(['ADMIN_LOCK', 'SELF_MANAGE'])
  percentLockMode!: 'ADMIN_LOCK' | 'SELF_MANAGE';
}

export class UserParamsDto {
  @IsString()
  @MinLength(30)
  @MaxLength(40)
  id!: string;
}
