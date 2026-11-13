import { Decimal } from 'decimal.js';

export const STAKE_BUTTONS = [10, 20, 50, 100, 200, 300, 500, 1000] as const;

export function permutations(number: string): string[] {
  if (!/^\d{2,3}$/.test(number)) {
    return [];
  }
  const found: string[] = [];
  const seen = new Set<string>();
  const chars = number.split('');
  const walk = (prefix: string, rest: string[]) => {
    if (rest.length === 0) {
      if (!seen.has(prefix)) {
        seen.add(prefix);
        found.push(prefix);
      }
      return;
    }
    const usedAtDepth = new Set<string>();
    rest.forEach((char, index) => {
      if (usedAtDepth.has(char)) {
        return;
      }
      usedAtDepth.add(char);
      walk(prefix + char, rest.filter((_, item) => item !== index));
    });
  };
  walk('', chars);
  return found;
}

export function parseFreeBaht(input: string): string | null {
  const trimmed = input.trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }
  const parsed = new Decimal(trimmed);
  if (parsed.lt(1) || parsed.gt(1_000_000)) {
    return null;
  }
  return parsed.toFixed(4);
}

export function addStake<T extends string>(
  lines: readonly { type: T; number: string; amount: string }[],
  type: T,
  number: string,
  amount: string,
): { type: T; number: string; amount: string }[] {
  const previous = lines.find((line) => line.type === type && line.number === number);
  const next = previous ? new Decimal(previous.amount).plus(amount).toFixed(4) : new Decimal(amount).toFixed(4);
  const rest = lines.filter((line) => !(line.type === type && line.number === number));
  return [...rest, { type, number, amount: next }];
}

export function addPermutations<T extends string>(
  lines: readonly { type: T; number: string; amount: string }[],
  type: T,
  number: string,
  amount: string,
): { type: T; number: string; amount: string }[] {
  return permutations(number).reduce((current, perm) => addStake(current, type, perm, amount), [...lines]);
}
