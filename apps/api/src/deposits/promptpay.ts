import { DomainError } from '../common/domain-error.js';
import { Decimal } from '../money/decimal.js';

const PROMPTPAY_AID = 'A000000677010111';

export function parseWholeBaht(input: string): Decimal {
  if (!/^\d{1,7}(\.0{1,4})?$/.test(input.trim())) {
    throw new DomainError('INVALID_AMOUNT');
  }
  const parsed = new Decimal(input.trim());
  if (parsed.lt(1) || parsed.gt(1_000_000)) {
    throw new DomainError('INVALID_AMOUNT');
  }
  return parsed;
}

export function allocateSatang(pendingSatangs: readonly number[]): number {
  const used = new Set(pendingSatangs.filter((value) => value >= 0 && value <= 99));
  for (let satang = 0; satang <= 99; satang += 1) {
    if (!used.has(satang)) {
      return satang;
    }
  }
  throw new DomainError('DEPOSIT_BUSY');
}

export function payableTotal(baht: Decimal, satang: number): Decimal {
  if (satang < 0 || satang > 99) {
    throw new DomainError('INVALID_AMOUNT');
  }
  return baht.plus(new Decimal(satang).div(100));
}

export function parseMatchAmount(input: string): Decimal {
  const trimmed = input.trim();
  if (!/^\d{1,11}(\.\d{1,4})?$/.test(trimmed)) {
    throw new DomainError('INVALID_AMOUNT');
  }
  const parsed = new Decimal(trimmed);
  if (parsed.lte(0) || parsed.gt(1_000_000)) {
    throw new DomainError('INVALID_AMOUNT');
  }
  return parsed.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function normalizePromptPayTarget(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (/^0\d{9}$/.test(trimmed) || /^\d{13}$/.test(trimmed)) {
    return trimmed;
  }
  throw new DomainError('INVALID_ITEM');
}

export function buildPromptPayPayload(target: string | null | undefined, amount: Decimal): string | null {
  const normalized = target ? normalizePromptPayTarget(target) : null;
  if (!normalized) {
    return null;
  }
  const proxy = normalized.startsWith('0')
    ? tlv('01', `0066${normalized.slice(1)}`)
    : tlv('02', normalized);
  const merchant = tlv('29', tlv('00', PROMPTPAY_AID) + proxy);
  const amountText = amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  const body =
    tlv('00', '01') +
    tlv('01', '12') +
    merchant +
    tlv('53', '764') +
    tlv('54', amountText) +
    tlv('58', 'TH') +
    '6304';
  return body + crc16(body);
}

export function formatExactAmount(amount: Decimal): string {
  return amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

function tlv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, '0')}${value}`;
}

function crc16(value: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(value, 'utf8')) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
