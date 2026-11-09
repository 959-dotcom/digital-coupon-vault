import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, IsUUID, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @Matches(/^\d{1,4}$/)
  sku!: string;

  @Matches(/^[1-9]\d{0,3}$/)
  quantity!: string;

  @Matches(/^\d{1,11}\.\d{4}$/)
  unitAmount!: string;
}

export class CreateOrderDto {
  @IsUUID()
  categoryId!: string;

  @IsUUID()
  batchId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

export class CategoryParamsDto {
  @IsUUID()
  id!: string;
}

export const IDEMPOTENCY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertIdempotencyKey(value: string | undefined): string {
  if (!value || !IDEMPOTENCY_PATTERN.test(value)) {
    throw new Error('INVALID_ITEM');
  }
  return value;
}

export type ConfirmOrderJob = {
  userId: string;
  partnerId: string;
  categoryId: string;
  batchId: string;
  items: Array<{ sku: string; quantity: string; unitAmount: string }>;
  idempotencyKey: string;
};

export type OrderReceipt = {
  id: string;
  status: string;
  txHash: string;
  totalAmount: string;
  items: unknown;
  createdAt: string;
  confirmedAt: string | null;
  vaultValid: boolean;
  categoryCode: string;
  categoryId: string;
  batchId: string;
};
