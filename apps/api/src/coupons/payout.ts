import { Decimal, ZERO, formatMoney } from '../money/decimal.js';
import { assertBalanced, type LedgerLine } from '../money/ledger.js';
import { digitsFor, type SelectionType } from './selection.js';

export type Outcome = {
  top3: string;
  bottom2: string;
};

export type Bet = {
  type: SelectionType;
  number: string;
  amount: Decimal;
};

export const PAYOUT_RATE: Record<SelectionType, string> = {
  TOP_3: '900.0000',
  PERM_3: '150.0000',
  TOP_2: '90.0000',
  BOTTOM_2: '90.0000',
  SINGLE_TOP: '3.0000',
  SINGLE_BOTTOM: '4.0000',
  RUNNING_MIX: '4.0000',
};

export function assertOutcome(outcome: Outcome): void {
  if (!/^\d{3}$/.test(outcome.top3) || !/^\d{2}$/.test(outcome.bottom2)) {
    throw new Error('INVALID_ITEM');
  }
}

export function payoutAmount(bet: Bet, outcome: Outcome): Decimal {
  assertOutcome(outcome);
  if (!wins(bet, outcome)) {
    return ZERO;
  }
  return bet.amount.mul(PAYOUT_RATE[bet.type]).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

export function payoutsByUser(
  bets: readonly { userId: string; bet: Bet }[],
  outcome: Outcome,
): Array<{ userId: string; amount: Decimal }> {
  const totals = new Map<string, Decimal>();
  for (const row of bets) {
    const won = payoutAmount(row.bet, outcome);
    if (won.lte(0)) {
      continue;
    }
    totals.set(row.userId, (totals.get(row.userId) ?? ZERO).plus(won));
  }
  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([userId, amount]) => ({ userId, amount }));
}

export function buildPayoutLedger(payouts: readonly { userId: string; amount: Decimal }[]): LedgerLine[] {
  const lines: LedgerLine[] = [];
  for (const payout of payouts) {
    if (payout.amount.lte(0)) {
      continue;
    }
    const amount = new Decimal(formatMoney(payout.amount));
    lines.push(
      {
        accountType: 'EXPENSE',
        accountCode: 'PAYOUT_EXPENSE',
        debit: amount,
        credit: ZERO,
        memo: 'PAYOUT_EXPENSE',
      },
      {
        accountType: 'LIABILITY',
        accountCode: `USER_POINTS:${payout.userId}`,
        debit: ZERO,
        credit: amount,
        memo: 'PAYOUT_POINTS',
      },
    );
  }
  if (lines.length > 0) {
    assertBalanced(lines);
  }
  return lines;
}

function wins(bet: Bet, outcome: Outcome): boolean {
  if (bet.number.length !== digitsFor(bet.type)) {
    return false;
  }
  switch (bet.type) {
    case 'TOP_3':
      return bet.number === outcome.top3;
    case 'PERM_3':
      return sortedDigits(bet.number) === sortedDigits(outcome.top3);
    case 'TOP_2':
      return bet.number === outcome.top3.slice(1);
    case 'BOTTOM_2':
      return bet.number === outcome.bottom2;
    case 'SINGLE_TOP':
      return outcome.top3.includes(bet.number);
    case 'SINGLE_BOTTOM':
      return outcome.bottom2.includes(bet.number);
    case 'RUNNING_MIX':
      return outcome.top3.includes(bet.number) || outcome.bottom2.includes(bet.number);
    default:
      return false;
  }
}

function sortedDigits(value: string): string {
  return value.split('').sort().join('');
}
