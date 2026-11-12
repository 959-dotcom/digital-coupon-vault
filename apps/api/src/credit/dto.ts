import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreditAmountDto {
  @IsString()
  @MinLength(6)
  @MaxLength(16)
  amount!: string;
}

export class CreditTransferDto extends CreditAmountDto {
  @IsUUID()
  receiverId!: string;
}
