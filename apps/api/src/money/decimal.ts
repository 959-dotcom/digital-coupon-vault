import { Decimal } from 'decimal.js';

Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
});

export { Decimal };

export const ZERO = new Decimal(0);
export const MONEY_SCALE = 4;
export const RATE_SCALE = 4;
const MINOR_FACTOR = new Decimal('10000');
const MAX_MINOR = new Decimal('9007199254740991');
const MAX_MONEY = new Decimal('100000000000');

export function decimalOf(value: Decimal.Value): Decimal {
  const parsed = new Decimal(value);
  if (!parsed.isFinite()) {
    throw new Error('INVALID_AMOUNT');
  }
  return parsed;
}

export function formatMoney(value: Decimal.Value): string {
  return decimalOf(value).toDecimalPlaces(MONEY_SCALE, Decimal.ROUND_HALF_UP).toFixed(MONEY_SCALE);
}

export function formatRate(value: Decimal.Value): string {
  return decimalOf(value).toDecimalPlaces(RATE_SCALE, Decimal.ROUND_HALF_UP).toFixed(RATE_SCALE);
}

export function parseExactMoney(input: string): Decimal {
  if (!/^\d{1,11}\.\d{4}$/.test(input)) {
    throw new Error('INVALID_AMOUNT');
  }
  const parsed = new Decimal(input);
  if (parsed.lte(0) || parsed.gte(MAX_MONEY)) {
    throw new Error('INVALID_AMOUNT');
  }
  return parsed;
}

export function parsePositiveQuantity(input: string): Decimal {
  if (!/^[1-9]\d{0,3}$/.test(input)) {
    throw new Error('INVALID_AMOUNT');
  }
  const parsed = new Decimal(input);
  if (!parsed.isInteger() || parsed.lte(0)) {
    throw new Error('INVALID_AMOUNT');
  }
  return parsed;
}

export function parseRateInput(input: string): string {
  if (!/^\d{1,2}(\.\d{1,8})?$/.test(input)) {
    throw new Error('INVALID_AMOUNT');
  }
  const parsed = new Decimal(input);
  if (parsed.lt(0) || parsed.gte(10)) {
    throw new Error('INVALID_AMOUNT');
  }
  return formatRate(parsed);
}

export function toMinorUnits(value: Decimal.Value): string {
  const parsed = decimalOf(value);
  if (parsed.lte(0)) {
    throw new Error('INVALID_AMOUNT');
  }
  const scaled = parsed.mul(MINOR_FACTOR);
  if (!scaled.isInteger() || scaled.gt(MAX_MINOR)) {
    throw new Error('INVALID_AMOUNT');
  }
  return scaled.toFixed(0);
}

export function minorUnitsToSafeInteger(minor: string): number {
  const parsed = new Decimal(minor);
  if (!parsed.isInteger() || parsed.lt(0) || parsed.gt(MAX_MINOR)) {
    throw new Error('INVALID_AMOUNT');
  }
  return parsed.toNumber();
}

export function moneyFromDatabase(value: { toString(): string } | string): Decimal {
  return decimalOf(typeof value === 'string' ? value : value.toString());
}
