import { Decimal, ZERO, formatMoney } from '../money/decimal.js';

const HUNDRED = new Decimal(100);

export type HoldPerson = {
  id: string;
  holdPercent: Decimal;
};

export type HoldSlice = {
  id: string;
  holdPercent: Decimal;
  amount: Decimal;
  receivedFromBelow: Decimal;
  sentUpward: Decimal;
  skipped: boolean;
};

export type HoldWaterfall = {
  nodes: HoldSlice[];
  admin: HoldSlice;
};

export function assertAdminBase(percent: Decimal): void {
  if (percent.lt(5) || percent.gt(100)) {
    throw new Error('HOLD_CAP');
  }
}

export function holdsWithinCap(holds: readonly Decimal[], adminBasePercent: Decimal): boolean {
  assertAdminBase(adminBasePercent);
  const sum = holds.reduce((total, hold) => total.plus(hold), ZERO);
  return sum.lte(HUNDRED.minus(adminBasePercent));
}

/**
 * Split a bill from the seller upward. Each hold is a percent of the bill.
 * A 0% hold keeps nothing and passes the same amount upward. The admin slice
 * is the exact remainder, so the slices sum to the bill.
 */
export function splitHoldWaterfall(
  bill: Decimal,
  adminBasePercent: Decimal,
  chainBottomToTop: readonly HoldPerson[],
  adminId: string,
): HoldWaterfall {
  if (!bill.isFinite() || bill.lte(0)) {
    throw new Error('INVALID_AMOUNT');
  }
  assertAdminBase(adminBasePercent);
  const holds = chainBottomToTop.map((node) => node.holdPercent);
  for (const hold of holds) {
    if (!hold.isFinite() || hold.lt(0) || hold.gt(HUNDRED)) {
      throw new Error('HOLD_CAP');
    }
  }
  if (!holdsWithinCap(holds, adminBasePercent)) {
    throw new Error('HOLD_CAP');
  }

  let received = bill;
  let allocated = ZERO;
  const nodes: HoldSlice[] = [];
  for (const node of chainBottomToTop) {
    const amount = node.holdPercent.eq(0)
      ? ZERO
      : bill.mul(node.holdPercent).div(HUNDRED).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    const sentUpward = received.minus(amount);
    nodes.push({
      id: node.id,
      holdPercent: node.holdPercent,
      amount,
      receivedFromBelow: received,
      sentUpward,
      skipped: node.holdPercent.eq(0),
    });
    received = sentUpward;
    allocated = allocated.plus(amount);
  }

  const adminAmount = bill.minus(allocated);
  const minimumAdmin = bill.mul(adminBasePercent).div(HUNDRED).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  if (adminAmount.lt(minimumAdmin)) {
    throw new Error('HOLD_CAP');
  }
  const admin: HoldSlice = {
    id: adminId,
    holdPercent: adminAmount.mul(HUNDRED).div(bill).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    amount: adminAmount,
    receivedFromBelow: adminAmount,
    sentUpward: ZERO,
    skipped: false,
  };
  const pieces = [...nodes.map((node) => node.amount), admin.amount];
  const total = pieces.reduce((sum, amount) => sum.plus(amount), ZERO);
  if (!total.eq(bill) || formatMoney(total) !== formatMoney(bill)) {
    throw new Error('UNBALANCED_LEDGER');
  }
  return { nodes, admin };
}

export function isSameOrDescendant(viewerPath: string, buyerPath: string): boolean {
  return buyerPath === viewerPath || buyerPath.startsWith(`${viewerPath}.`);
}
