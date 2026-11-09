import { Decimal, formatMoney, parseExactMoney, parsePositiveQuantity } from '../money/decimal.js';
import type { VaultItem } from '../vault/canonical.js';
import { DomainError } from '../common/domain-error.js';

export type OrderItemInput = {
  sku: string;
  quantity: string;
  unitAmount: string;
};

export type ItemRules = {
  gridMin: number;
  gridMax: number;
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
  const merged = new Map<string, { quantity: Decimal; unitAmount: Decimal }>();

  for (const input of inputs) {
    if (!/^\d{1,4}$/.test(input.sku)) {
      throw new DomainError('INVALID_ITEM');
    }
    const index = new Decimal(input.sku);
    if (!index.isInteger() || index.lt(rules.gridMin) || index.gt(rules.gridMax)) {
      throw new DomainError('INVALID_ITEM');
    }
    const sku = index.toFixed(0).padStart(rules.pad, '0');
    const quantity = parsePositiveQuantity(input.quantity);
    const unitAmount = parseExactMoney(input.unitAmount);
    if (!stakes.some((stake) => stake.eq(unitAmount))) {
      throw new DomainError('INVALID_AMOUNT');
    }
    const current = merged.get(sku);
    if (!current) {
      merged.set(sku, { quantity, unitAmount });
      continue;
    }
    if (!current.unitAmount.eq(unitAmount)) {
      throw new DomainError('INVALID_ITEM');
    }
    const nextQuantity = current.quantity.plus(quantity);
    if (nextQuantity.gt(9999)) {
      throw new DomainError('INVALID_AMOUNT');
    }
    current.quantity = nextQuantity;
  }

  const items = [...merged.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([sku, line]) => {
      const lineAmount = line.quantity.mul(line.unitAmount);
      return {
        sku,
        label: `No. ${sku}`,
        quantity: line.quantity.toFixed(0),
        unitAmount: formatMoney(line.unitAmount),
        lineAmount: formatMoney(lineAmount),
      };
    });

  const total = items.reduce((sum, item) => sum.plus(new Decimal(item.lineAmount)), new Decimal(0));
  if (total.lte(0) || total.gte('100000000000')) {
    throw new DomainError('INVALID_AMOUNT');
  }
  return { items, total };
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
    const item: VaultItem = {
      sku: stringField(row.sku),
      label: stringField(row.label),
      quantity: stringField(row.quantity),
      unitAmount: stringField(row.unitAmount),
      lineAmount: stringField(row.lineAmount),
    };
    return item;
  });
}

function stringField(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new DomainError('VAULT_MISMATCH');
  }
  return value;
}
