import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { allocateCommissions, nonSplitCommissionConserved, shareAmountMatchesRate, volumeConserved } from '../src/commission/commission-math.js';
import { Decimal } from '../src/money/decimal.js';
import { assertBalanced, buildCouponLedger, sumSides } from '../src/money/ledger.js';
import { reserveBalanceLua, releaseBalanceLua } from '../src/redis/lua-scripts.js';
import { computeTxHash, hashesMatch } from '../src/vault/canonical.js';
import { cutoffInstant, isPastCutoff } from '../src/cutoff/cutoff.js';

const volume = new Decimal('1000.0000');

function node(id: string, mode: 'COMMISSION_ONLY' | 'FULL_PASS' | 'SPLIT_KEEP', rate: string) {
  return { id, mode, rate: new Decimal(rate) };
}

test('commission-only differentials telescope and the ledger balances', () => {
  const allocation = allocateCommissions(
    [node('c', 'COMMISSION_ONLY', '0.1000'), node('b', 'COMMISSION_ONLY', '0.0600'), node('a', 'COMMISSION_ONLY', '0.0200')],
    volume,
    'D2',
  );
  assert.deepEqual(
    allocation.payable.map((share) => share.amount.toFixed(4)),
    ['40.0000', '40.0000', '20.0000'],
  );
  assert.equal(nonSplitCommissionConserved(allocation, volume), true);
  assert.equal(volumeConserved(volume, allocation.shares, allocation.residualVolume), true);
  assert.equal(allocation.residualVolume.toFixed(4), '1000.0000');
  for (const share of allocation.payable) {
    assert.equal(shareAmountMatchesRate(share), true);
  }
  const lines = buildCouponLedger({ userId: 'user', total: volume, commissions: allocation.payable });
  const totals = assertBalanced(lines);
  assert.equal(totals.debit.toFixed(4), '1100.0000');
  assert.equal(sumSides(lines).balanced, true);
});

test('full-pass keeps nothing and the skipped rate is earned upstream', () => {
  const allocation = allocateCommissions(
    [node('c', 'COMMISSION_ONLY', '0.1000'), node('b', 'FULL_PASS', '0.0600'), node('a', 'COMMISSION_ONLY', '0.0200')],
    volume,
    'D2',
  );
  assert.equal(allocation.payable.some((share) => share.partnerId === 'b'), false);
  assert.deepEqual(
    allocation.payable.map((share) => `${share.partnerId}:${share.amount.toFixed(4)}`),
    ['c:40.0000', 'a:60.0000'],
  );
  assert.equal(nonSplitCommissionConserved(allocation, volume), true);
  const lines = buildCouponLedger({ userId: 'user', total: volume, commissions: allocation.payable });
  assert.equal(assertBalanced(lines).debit.eq(assertBalanced(lines).credit), true);
});

test('a full-pass leaf passes its rate and earns zero', () => {
  const allocation = allocateCommissions(
    [node('c', 'FULL_PASS', '0.1000'), node('b', 'COMMISSION_ONLY', '0.0600'), node('a', 'COMMISSION_ONLY', '0.0200')],
    volume,
    'D2',
  );
  assert.equal(allocation.payable.some((share) => share.partnerId === 'c'), false);
  assert.equal(nonSplitCommissionConserved(allocation, volume), true);
  assert.equal(
    allocation.payable.reduce((sum, share) => sum.plus(share.amount), new Decimal(0)).toFixed(4),
    '100.0000',
  );
});

test('split-keep retains volume ratio and passes the remainder', () => {
  const allocation = allocateCommissions(
    [node('c', 'SPLIT_KEEP', '0.5000'), node('b', 'COMMISSION_ONLY', '0.2000'), node('a', 'COMMISSION_ONLY', '0.1000')],
    volume,
    'D2',
  );
  const child = allocation.payable.find((share) => share.partnerId === 'c');
  assert.ok(child);
  assert.equal(child.baseAmount.toFixed(4), '500.0000');
  assert.equal(child.rate.toFixed(4), '0.3000');
  assert.equal(child.amount.toFixed(4), '150.0000');
  assert.equal(allocation.residualVolume.toFixed(4), '500.0000');
  assert.equal(volumeConserved(volume, allocation.shares, allocation.residualVolume), true);
  assert.deepEqual(
    allocation.payable.map((share) => share.amount.toFixed(4)),
    ['150.0000', '50.0000', '50.0000'],
  );
  const lines = buildCouponLedger({ userId: 'user', total: volume, commissions: allocation.payable });
  const totals = assertBalanced(lines);
  assert.equal(totals.debit.minus(totals.credit).toFixed(4), '0.0000');
});

test('all three modes in one chain conserve volume and balance the ledger', () => {
  const allocation = allocateCommissions(
    [node('c', 'SPLIT_KEEP', '0.4000'), node('b', 'FULL_PASS', '0.2000'), node('a', 'COMMISSION_ONLY', '0.1000')],
    volume,
    'D2',
  );
  assert.equal(allocation.payable.some((share) => share.partnerId === 'b'), false);
  assert.equal(volumeConserved(volume, allocation.shares, allocation.residualVolume), true);
  assert.equal(allocation.residualVolume.toFixed(4), '600.0000');
  assert.deepEqual(
    allocation.payable.map((share) => `${share.partnerId}:${share.amount.toFixed(4)}`),
    ['c:80.0000', 'a:120.0000'],
  );
  const lines = buildCouponLedger({ userId: 'user', total: volume, commissions: allocation.payable });
  assert.doesNotThrow(() => assertBalanced(lines));
  assert.equal(sumSides(lines).debit, sumSides(lines).credit);
});

test('vault hash is stable and rejects tampering', () => {
  const createdAt = new Date('2026-11-09T08:30:00.000Z');
  const items = [
    {
      type: 'TOP_2',
      number: '07',
      amount: '20.0000',
    },
  ];
  const input = {
    id: 'tx-1',
    userId: 'user-1',
    items,
    totalAmount: new Decimal('20.0000'),
    createdAt,
    secret: 'test-vault-secret-test-vault-secret',
  };
  const hash = computeTxHash(input);
  assert.equal(hash, computeTxHash({ ...input, items: [{ ...items[0] }] }));
  assert.equal(hashesMatch(hash, computeTxHash(input)), true);
  assert.equal(hashesMatch(hash, computeTxHash({ ...input, totalAmount: new Decimal('21.0000') })), false);
});

test('cutoff uses the server instant against Asia/Bangkok civil time', () => {
  const batchDate = new Date(Date.UTC(2026, 10, 9));
  const cutoff = cutoffInstant(batchDate, '15:30:00');
  assert.equal(cutoff.toISOString(), '2026-11-09T08:30:00.000Z');
  assert.equal(isPastCutoff(cutoff, batchDate, '15:30:00'), false);
  assert.equal(isPastCutoff(new Date(cutoff.getTime() + 1000), batchDate, '15:30:00'), true);
});

test('reserve lua is loaded as the string the wallet service evals', () => {
  assert.equal(typeof reserveBalanceLua, 'string');
  assert.match(reserveBalanceLua, /DECRBY/);
  assert.match(reserveBalanceLua, /ARGV\[2\]/);
  assert.match(releaseBalanceLua, /INCRBY/);
  const wallet = readFileSync(new URL('../src/redis/wallet.service.ts', import.meta.url), 'utf8');
  assert.match(wallet, /reserveBalanceLua/);
  assert.match(wallet, /\.eval\s*\(/);
});
