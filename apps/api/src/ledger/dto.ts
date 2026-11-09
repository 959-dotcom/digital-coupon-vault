import { IsString, IsUUID, Length, Matches } from 'class-validator';

export class WithdrawalIdDto {
  @IsUUID()
  id!: string;
}

export class CreateWithdrawalDto {
  @Matches(/^\d{1,11}\.\d{4}$/)
  amount!: string;

  @IsString()
  @Length(1, 80)
  destination!: string;
}

export class FundPointsDto {
  @IsUUID()
  userId!: string;

  @Matches(/^\d{1,11}\.\d{4}$/)
  amount!: string;

  @IsString()
  @Length(1, 160)
  memo!: string;
}
