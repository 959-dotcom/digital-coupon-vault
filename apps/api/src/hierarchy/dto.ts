import { IsBoolean, IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';

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
