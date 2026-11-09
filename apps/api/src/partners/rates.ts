import { parseRateInput } from '../money/decimal.js';
import { DomainError } from '../common/domain-error.js';

const LABEL = /^[A-Za-z][A-Za-z0-9_]{0,62}$/;

export function assertPartnerCode(code: string): string {
  if (!LABEL.test(code)) {
    throw new DomainError('INVALID_ITEM');
  }
  return code;
}

export function childPath(parentPath: string | null, code: string): string {
  const label = assertPartnerCode(code);
  if (!parentPath) {
    return label;
  }
  if (!/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/.test(parentPath)) {
    throw new DomainError('INVALID_ITEM');
  }
  return `${parentPath}.${label}`;
}

export function normalizeCommissionRates(
  input: Record<string, string>,
  categoryCodes: readonly string[],
): Record<string, string> {
  const allowed = new Set(categoryCodes);
  const normalized: Record<string, string> = {};
  for (const [code, rate] of Object.entries(input)) {
    if (!allowed.has(code)) {
      throw new DomainError('UNKNOWN_CATEGORY');
    }
    try {
      normalized[code] = parseRateInput(rate);
    } catch {
      throw new DomainError('INVALID_AMOUNT');
    }
  }
  return normalized;
}

export function readCommissionRates(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const output: Record<string, string> = {};
  for (const [code, rate] of Object.entries(value as Record<string, unknown>)) {
    if (typeof rate === 'string' || typeof rate === 'number') {
      output[code] = parseRateInput(String(rate));
    }
  }
  return output;
}

export function categoryRate(value: unknown, categoryCode: string): string {
  const rates = readCommissionRates(value);
  return rates[categoryCode] ?? '0.0000';
}
