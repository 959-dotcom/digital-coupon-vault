import { Decimal, ZERO } from '../money/decimal.js';

export type JournalLine = {
  transactionId: string;
  debit: string;
  credit: string;
};

export type JournalMismatch = {
  transactionId: string;
  debit: string;
  credit: string;
};

export function auditJournals(lines: readonly JournalLine[]): {
  journals: number;
  mismatches: JournalMismatch[];
} {
  const totals = new Map<string, { debit: Decimal; credit: Decimal }>();
  for (const line of lines) {
    const current = totals.get(line.transactionId) ?? { debit: ZERO, credit: ZERO };
    current.debit = current.debit.plus(new Decimal(line.debit));
    current.credit = current.credit.plus(new Decimal(line.credit));
    totals.set(line.transactionId, current);
  }
  const mismatches: JournalMismatch[] = [];
  for (const [transactionId, sides] of totals) {
    if (!sides.debit.eq(sides.credit)) {
      mismatches.push({
        transactionId,
        debit: sides.debit.toFixed(4),
        credit: sides.credit.toFixed(4),
      });
    }
  }
  return { journals: totals.size, mismatches };
}
