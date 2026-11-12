import { IsBoolean, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateDepositDto {
  @Matches(/^\d{1,7}(\.0{1,4})?$/)
  amount!: string;
}

export class DepositIdDto {
  @IsUUID()
  id!: string;
}

export class MatchDepositDto {
  @Matches(/^\d{1,11}\.\d{4}$/)
  amount!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(80)
  bankRef!: string;
}

export class SlipDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  filename!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(2_100_000)
  contentBase64!: string;
}

export class PaymentSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  promptPayId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  telegramChatId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  telegramBotToken?: string;

  @IsOptional()
  @IsBoolean()
  clearTelegramToken?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  payoutRail?: string;
}
