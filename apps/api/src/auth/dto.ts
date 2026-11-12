import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
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

  @IsString()
  @MinLength(2)
  @MaxLength(32)
  ref!: string;
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
  @IsEmail()
  @MaxLength(180)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}
