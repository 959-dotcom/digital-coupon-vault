import { Prisma } from '../generated/prisma/client.js';
import { DomainError } from '../common/domain-error.js';
import { Decimal, ZERO } from '../money/decimal.js';

export function assertCutoffOpen(now: Date, cutoffAt: Date): void {
  if (now.getTime() > cutoffAt.getTime()) {
    throw new DomainError('CUTOFF_PASSED');
  }
}

export async function lockUserAndAssertBalance(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: Decimal,
): Promise<void> {
  if (amount.lte(0)) {
    throw new DomainError('INVALID_AMOUNT');
  }
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE
  `;
  if (locked.length !== 1) {
    throw new DomainError('USER_INACTIVE');
  }
  const rows = await tx.$queryRaw<Array<{ debit: string; credit: string }>>`
    SELECT debit::text AS debit, credit::text AS credit
    FROM "LedgerEntry"
    WHERE "accountCode" = ${`USER_POINTS:${userId}`}
  `;
  let available = ZERO;
  for (const row of rows) {
    available = available.plus(new Decimal(row.credit)).minus(new Decimal(row.debit));
  }
  if (amount.gt(available)) {
    throw new DomainError('INSUFFICIENT_BALANCE');
  }
}
