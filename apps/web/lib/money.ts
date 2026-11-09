import { Decimal } from 'decimal.js';

export function formatPoints(value: string): string {
  const parsed = new Decimal(value);
  const negative = parsed.isNegative();
  const [whole, fraction] = parsed.abs().toFixed(4).split('.');
  const grouped = (whole ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}.${fraction ?? '0000'}`;
}

export function exactMoney(input: string): string {
  return new Decimal(input).toFixed(4);
}
