import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { BANK_PROVIDERS, SOURCE_CHANNELS } from './registration.js';

export class RegisterDto {
  @IsString()
  @MinLength(10)
  @MaxLength(10)
  phone!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  pin!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  pinConfirm!: string;

  @IsIn(BANK_PROVIDERS)
  bankProvider!: (typeof BANK_PROVIDERS)[number];

  @IsString()
  @MinLength(10)
  @MaxLength(15)
  accountNumber!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  lineId?: string;

  @IsIn(SOURCE_CHANNELS)
  sourceChannel!: (typeof SOURCE_CHANNELS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(32)
  ref?: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  newPassword!: string;
}

export class LoginDto {
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(200)
  password!: string;
}

export class ChangePinDto {
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  currentPin?: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  pin!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  pinConfirm!: string;
}
