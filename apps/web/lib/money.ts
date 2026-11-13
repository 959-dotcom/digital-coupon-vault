import { Decimal } from 'decimal.js';

export const PRESET_STAKES = ['10.0000', '20.0000', '50.0000', '100.0000'] as const;

export function livePointsTotal(lines: readonly { amount: string }[], draft: string | null): string {
  const base = lines.reduce((sum, line) => sum.plus(line.amount), new Decimal(0));
  return (draft ? base.plus(draft) : base).toFixed(4);
}

export function formatPoints(value: string): string {
  const parsed = new Decimal(value);
  const negative = parsed.isNegative();
  const [whole, fraction] = parsed.abs().toFixed(2).split('.');
  const grouped = (whole ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}.${fraction ?? '00'}`;
}

export function exactMoney(input: string): string {
  return new Decimal(input).toFixed(4);
}
