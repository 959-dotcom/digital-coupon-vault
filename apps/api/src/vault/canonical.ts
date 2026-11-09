import { createHash, timingSafeEqual } from 'node:crypto';
import { Decimal, formatMoney } from '../money/decimal.js';

export type VaultItem = {
  sku: string;
  label: string;
  quantity: string;
  unitAmount: string;
  lineAmount: string;
};

export type VaultPreimage = {
  id: string;
  userId: string;
  items: readonly VaultItem[];
  totalAmount: Decimal;
  createdAt: Date;
  secret: string;
};

export function stableStringify(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('INVALID_AMOUNT');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
  }
  throw new Error('INVALID_AMOUNT');
}

export function vaultCanonicalString(input: VaultPreimage): string {
  return [
    input.id,
    input.userId,
    stableStringify(input.items),
    formatMoney(input.totalAmount),
    input.createdAt.toISOString(),
    input.secret,
  ].join('|');
}

export function computeTxHash(input: VaultPreimage): string {
  return createHash('sha256').update(vaultCanonicalString(input), 'utf8').digest('hex');
}

export function hashesMatch(left: string, right: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(left) || !/^[0-9a-f]{64}$/i.test(right)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}
