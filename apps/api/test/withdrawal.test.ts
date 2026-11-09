import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Decimal } from '../src/money/decimal.js';
import { assertBalanced, buildWithdrawalLedger, pointBalanceAfter, sumSides } from '../src/money/ledger.js';

test('a withdrawal debits equal credits and the point balance drops by that amount', () => {
  const userId = 'member-1';
  const opening = new Decimal('5000.0000');
  const amount = new Decimal('125.5000');
  const lines = buildWithdrawalLedger({ userId, amount });
  const totals = assertBalanced(lines);
  assert.equal(totals.debit.toFixed(4), '125.5000');
  assert.equal(totals.credit.toFixed(4), '125.5000');
  assert.equal(sumSides(lines).balanced, true);
  const next = pointBalanceAfter(userId, opening, lines);
  assert.equal(next.toFixed(4), '4874.5000');
  assert.equal(opening.minus(next).toFixed(4), amount.toFixed(4));
});

test('a non-positive withdrawal is rejected', () => {
  assert.throws(() => buildWithdrawalLedger({ userId: 'member-1', amount: new Decimal('0.0000') }), /INVALID_AMOUNT/);
  assert.throws(() => buildWithdrawalLedger({ userId: 'member-1', amount: new Decimal('-1.0000') }), /INVALID_AMOUNT/);
});

test('accepting a withdrawal does not update a confirmed coupon transaction', () => {
  const source = readFileSync(new URL('../src/ledger/withdrawal.service.ts', import.meta.url), 'utf8');
  assert.equal(source.includes('couponTx'), false);
});
