import { IsBoolean, IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import type { ReportScope } from '../access/permissions.js';

export class CreateStaffDto {
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
  viewBalance!: boolean;

  @IsIn(['all', 'downline', 'none'])
  viewReports!: ReportScope;

  @IsBoolean()
  manageCredit!: boolean;

  @IsBoolean()
  manageMembers!: boolean;
}

export class UpdateStaffDto {
  @IsBoolean()
  viewBalance!: boolean;

  @IsIn(['all', 'downline', 'none'])
  viewReports!: ReportScope;

  @IsBoolean()
  manageCredit!: boolean;

  @IsBoolean()
  manageMembers!: boolean;
}

export class StaffParamsDto {
  @IsString()
  @MinLength(30)
  @MaxLength(40)
  id!: string;
}
