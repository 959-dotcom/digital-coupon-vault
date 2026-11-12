import { Decimal, ZERO, formatMoney } from './decimal.js';

export type AccountTypeName = 'ASSET' | 'LIABILITY' | 'REVENUE' | 'EXPENSE';

export type LedgerLine = {
  accountType: AccountTypeName;
  accountCode: string;
  debit: Decimal;
  credit: Decimal;
  memo: string;
};

export type CommissionPayable = {
  partnerId: string;
  amount: Decimal;
};

export function assertBalanced(lines: readonly LedgerLine[]): { debit: Decimal; credit: Decimal } {
  let debit = ZERO;
  let credit = ZERO;
  for (const line of lines) {
    if (line.debit.lt(0) || line.credit.lt(0)) {
      throw new Error('UNBALANCED_LEDGER');
    }
    if (line.debit.gt(0) && line.credit.gt(0)) {
      throw new Error('UNBALANCED_LEDGER');
    }
    if (line.debit.eq(0) && line.credit.eq(0)) {
      throw new Error('UNBALANCED_LEDGER');
    }
    debit = debit.plus(line.debit);
    credit = credit.plus(line.credit);
  }
  if (!debit.eq(credit)) {
    throw new Error('UNBALANCED_LEDGER');
  }
  return { debit, credit };
}

export function buildCouponLedger(input: {
  userId: string;
  total: Decimal;
  commissions: readonly CommissionPayable[];
}): LedgerLine[] {
  const lines: LedgerLine[] = [
    {
      accountType: 'LIABILITY',
      accountCode: `USER_POINTS:${input.userId}`,
      debit: input.total,
      credit: ZERO,
      memo: 'REDEEM_POINTS',
    },
    {
      accountType: 'REVENUE',
      accountCode: 'PLATFORM_SALES',
      debit: ZERO,
      credit: input.total,
      memo: 'COUPON_SALE',
    },
  ];
  for (const commission of input.commissions) {
    if (commission.amount.lte(0)) {
      continue;
    }
    lines.push(
      {
        accountType: 'EXPENSE',
        accountCode: `COMMISSION_EXPENSE:${commission.partnerId}`,
        debit: commission.amount,
        credit: ZERO,
        memo: 'COMMISSION_EXPENSE',
      },
      {
        accountType: 'LIABILITY',
        accountCode: `PARTNER_PAYABLE:${commission.partnerId}`,
        debit: ZERO,
        credit: commission.amount,
        memo: 'COMMISSION_PAYABLE',
      },
    );
  }
  assertBalanced(lines);
  return lines;
}

export function buildFundingLedger(input: { userId: string; amount: Decimal }): LedgerLine[] {
  const lines: LedgerLine[] = [
    {
      accountType: 'ASSET',
      accountCode: 'PLATFORM_CASH',
      debit: input.amount,
      credit: ZERO,
      memo: 'FUND_CASH',
    },
    {
      accountType: 'LIABILITY',
      accountCode: `USER_POINTS:${input.userId}`,
      debit: ZERO,
      credit: input.amount,
      memo: 'FUND_POINTS',
    },
  ];
  assertBalanced(lines);
  return lines;
}

export function buildWithdrawalLedger(input: { userId: string; amount: Decimal }): LedgerLine[] {
  if (input.amount.lte(0)) {
    throw new Error('INVALID_AMOUNT');
  }
  const lines: LedgerLine[] = [
    {
      accountType: 'LIABILITY',
      accountCode: `USER_POINTS:${input.userId}`,
      debit: input.amount,
      credit: ZERO,
      memo: 'WITHDRAW_POINTS',
    },
    {
      accountType: 'ASSET',
      accountCode: 'PLATFORM_CASH',
      debit: ZERO,
      credit: input.amount,
      memo: 'WITHDRAW_CASH',
    },
  ];
  assertBalanced(lines);
  return lines;
}

export function buildDepositLedger(input: { userId: string; amount: Decimal; depositId: string }): LedgerLine[] {
  if (input.amount.lte(0)) {
    throw new Error('INVALID_AMOUNT');
  }
  const lines: LedgerLine[] = [
    {
      accountType: 'ASSET',
      accountCode: 'PROMPTPAY_CLEARING',
      debit: input.amount,
      credit: ZERO,
      memo: 'DEPOSIT_CASH',
    },
    {
      accountType: 'LIABILITY',
      accountCode: `USER_CASH:${input.userId}`,
      debit: ZERO,
      credit: input.amount,
      memo: `DEPOSIT_CREDIT:${input.depositId}`,
    },
  ];
  assertBalanced(lines);
  return lines;
}

export function buildCashWithdrawalLedger(input: { userId: string; amount: Decimal }): LedgerLine[] {
  if (input.amount.lte(0)) {
    throw new Error('INVALID_AMOUNT');
  }
  const lines: LedgerLine[] = [
    {
      accountType: 'LIABILITY',
      accountCode: `USER_CASH:${input.userId}`,
      debit: input.amount,
      credit: ZERO,
      memo: 'WITHDRAW_QUEUED',
    },
    {
      accountType: 'ASSET',
      accountCode: 'PLATFORM_CASH',
      debit: ZERO,
      credit: input.amount,
      memo: 'WITHDRAW_QUEUED',
    },
  ];
  assertBalanced(lines);
  return lines;
}

export function pointBalanceAfter(userId: string, opening: Decimal, lines: readonly LedgerLine[]): Decimal {
  const accountCode = `USER_POINTS:${userId}`;
  return lines
    .filter((line) => line.accountCode === accountCode)
    .reduce((balance, line) => balance.plus(line.credit).minus(line.debit), opening);
}

export function sumSides(lines: readonly { debit: Decimal; credit: Decimal }[]): {
  debit: string;
  credit: string;
  balanced: boolean;
} {
  let debit = ZERO;
  let credit = ZERO;
  for (const line of lines) {
    debit = debit.plus(line.debit);
    credit = credit.plus(line.credit);
  }
  return {
    debit: formatMoney(debit),
    credit: formatMoney(credit),
    balanced: debit.eq(credit),
  };
}
