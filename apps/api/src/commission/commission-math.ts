import { Decimal, ZERO, formatMoney, formatRate } from '../money/decimal.js';

export type DistributionModeName = 'COMMISSION_ONLY' | 'FULL_PASS' | 'SPLIT_KEEP';

export type ChainNode = {
  id: string;
  mode: DistributionModeName;
  rate: Decimal;
};

export type CommissionShare = {
  partnerId: string;
  mode: DistributionModeName;
  categoryCode: string;
  rate: Decimal;
  baseAmount: Decimal;
  amount: Decimal;
};

export type Allocation = {
  shares: CommissionShare[];
  payable: CommissionShare[];
  residualVolume: Decimal;
  residualCommission: Decimal;
  leafRate: Decimal;
};

/**
 * Walk the selling partner and ancestors from the bottom of the tree to the root.
 *
 * COMMISSION_ONLY earns max(childRate - parentRate, 0) on the open volume.
 * The open volume (the risk) passes unchanged to the parent.
 *
 * FULL_PASS earns nothing. The kept rate is explicitly 0.
 * The node's own rate is not retained: it is carried upward and becomes the next
 * earning node's child rate, so a non-split chain still telescopes to the leaf rate.
 *
 * SPLIT_KEEP keeps min(rate, 1) of the open volume and passes the remainder up.
 * The differential is max(childRate - parentRate, 0), applied only to the kept volume.
 */
export function allocateCommissions(
  chainBottomToTop: readonly ChainNode[],
  volume: Decimal,
  categoryCode: string,
): Allocation {
  if (chainBottomToTop.length === 0) {
    throw new Error('EMPTY_CHAIN');
  }
  if (volume.lte(0)) {
    throw new Error('INVALID_AMOUNT');
  }

  const leafRate = chainBottomToTop[0]?.rate ?? ZERO;
  let openVolume = volume;
  let carried: Decimal | null = null;
  const shares: CommissionShare[] = [];

  for (let index = 0; index < chainBottomToTop.length; index += 1) {
    const node = chainBottomToTop[index];
    if (!node) {
      continue;
    }
    const parentRate = chainBottomToTop[index + 1]?.rate ?? ZERO;

    if (node.mode === 'FULL_PASS') {
      if (carried === null) {
        carried = node.rate;
      }
      continue;
    }

    const childRate = carried ?? node.rate;
    const differential = Decimal.max(childRate.minus(parentRate), ZERO);
    carried = null;

    if (node.mode === 'COMMISSION_ONLY') {
      const amount = openVolume.mul(differential).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
      shares.push({
        partnerId: node.id,
        mode: node.mode,
        categoryCode,
        rate: differential,
        baseAmount: openVolume,
        amount,
      });
      continue;
    }

    const ratio = Decimal.min(Decimal.max(node.rate, ZERO), new Decimal(1));
    const kept = openVolume.mul(ratio).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    const amount = kept.mul(differential).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    openVolume = openVolume.minus(kept);
    shares.push({
      partnerId: node.id,
      mode: node.mode,
      categoryCode,
      rate: differential,
      baseAmount: kept,
      amount,
    });
  }

  const residualCommission =
    carried === null ? ZERO : openVolume.mul(carried).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

  return {
    shares,
    payable: shares.filter((share) => share.amount.gt(0)),
    residualVolume: openVolume,
    residualCommission,
    leafRate,
  };
}

export function volumeConserved(volume: Decimal, shares: readonly CommissionShare[], residualVolume: Decimal): boolean {
  const kept = shares
    .filter((share) => share.mode === 'SPLIT_KEEP')
    .reduce((sum, share) => sum.plus(share.baseAmount), ZERO);
  return kept.plus(residualVolume).eq(volume);
}

export function nonSplitCommissionConserved(allocation: Allocation, volume: Decimal): boolean {
  const paid = allocation.payable.reduce((sum, share) => sum.plus(share.amount), ZERO);
  const expected = volume.mul(allocation.leafRate).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  return paid.plus(allocation.residualCommission).eq(expected);
}

export function shareAmountMatchesRate(share: CommissionShare): boolean {
  const expected = share.baseAmount.mul(share.rate).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  return expected.eq(share.amount) && formatRate(share.rate).length > 0 && formatMoney(share.amount).length > 0;
}
