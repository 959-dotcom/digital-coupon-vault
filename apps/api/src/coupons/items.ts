import { Decimal, formatMoney, parseExactMoney } from '../money/decimal.js';
import type { VaultItem } from '../vault/canonical.js';
import { DomainError } from '../common/domain-error.js';
import { digitsFor, isSelectionType, numberMatchesType, type SelectionType } from './selection.js';

export type OrderItemInput = {
  type: string;
  number: string;
  amount: string;
};

export type ItemRules = {
  pad: number;
  stakeAmounts: unknown;
};

export function canonicalizeItems(rules: ItemRules, inputs: readonly OrderItemInput[]): {
  items: VaultItem[];
  total: Decimal;
} {
  if (inputs.length === 0 || inputs.length > 100) {
    throw new DomainError('INVALID_ITEM');
  }
  const stakes = readStakes(rules.stakeAmounts);
  const merged = new Map<string, { type: SelectionType; number: string; amount: Decimal }>();

  for (const input of inputs) {
    if (!isSelectionType(input.type) || !numberMatchesType(input.type, input.number)) {
      throw new DomainError('INVALID_ITEM');
    }
    if (digitsFor(input.type) > rules.pad) {
      throw new DomainError('INVALID_ITEM');
    }
    const amount = parseExactMoney(input.amount);
    if (!isStakeMultiple(amount, stakes)) {
      throw new DomainError('INVALID_AMOUNT');
    }
    const key = `${input.type}:${input.number}`;
    const current = merged.get(key);
    const nextAmount = current ? current.amount.plus(amount) : amount;
    if (!isStakeMultiple(nextAmount, stakes)) {
      throw new DomainError('INVALID_AMOUNT');
    }
    merged.set(key, { type: input.type, number: input.number, amount: nextAmount });
  }

  const items = [...merged.values()]
    .sort((left, right) => `${left.type}:${left.number}`.localeCompare(`${right.type}:${right.number}`))
    .map((line) => ({
      type: line.type,
      number: line.number,
      amount: formatMoney(line.amount),
    }));

  const total = items.reduce((sum, item) => sum.plus(new Decimal(item.amount)), new Decimal(0));
  if (total.lte(0) || total.gte('100000000000')) {
    throw new DomainError('INVALID_AMOUNT');
  }
  return { items, total };
}

function isStakeMultiple(amount: Decimal, stakes: readonly Decimal[]): boolean {
  return stakes.some((stake) => {
    const quantity = amount.div(stake);
    return quantity.isInteger() && quantity.gte(1) && quantity.lte(9999);
  });
}

function readStakes(value: unknown): Decimal[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new DomainError('INVALID_AMOUNT');
  }
  return value.map((entry) => parseExactMoney(String(entry)));
}

export function readStoredItems(value: unknown): VaultItem[] {
  if (!Array.isArray(value)) {
    throw new DomainError('VAULT_MISMATCH');
  }
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      throw new DomainError('VAULT_MISMATCH');
    }
    const row = entry as Record<string, unknown>;
    const type = stringField(row.type);
    const number = stringField(row.number);
    const amount = stringField(row.amount);
    if (!isSelectionType(type) || !numberMatchesType(type, number)) {
      throw new DomainError('VAULT_MISMATCH');
    }
    parseExactMoney(amount);
    return { type, number, amount };
  });
}

function stringField(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new DomainError('VAULT_MISMATCH');
  }
  return value;
}
