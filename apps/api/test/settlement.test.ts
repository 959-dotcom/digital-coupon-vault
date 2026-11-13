import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CATEGORY_SEEDS } from '../src/coupons/category-catalog.js';
import { canonicalizeItems } from '../src/coupons/items.js';
import { buildPayoutLedger, payoutAmount, payoutsByUser } from '../src/coupons/payout.js';
import { nextSession, parseSchedule } from '../src/coupons/schedule.js';
import { Decimal } from '../src/money/decimal.js';
import { assertBalanced } from '../src/money/ledger.js';

const outcome = { top3: '123', bottom2: '45' };
const stakes = ['10.0000', '20.0000'];

test('settlement payouts are deterministic and the ledger balances', () => {
  const bets = [
    bet('member-a', 'TOP_3', '123', '10.0000'),
    bet('member-a', 'PERM_3', '321', '10.0000'),
    bet('member-b', 'TOP_2', '23', '10.0000'),
    bet('member-b', 'BOTTOM_2', '45', '10.0000'),
    bet('member-c', 'SINGLE_TOP', '1', '10.0000'),
    bet('member-c', 'SINGLE_BOTTOM', '9', '10.0000'),
    bet('member-c', 'RUNNING_MIX', '4', '10.0000'),
    bet('member-c', 'TOP_3', '999', '10.0000'),
  ];
  assert.equal(payoutAmount(bets[0].bet, outcome).toFixed(4), '9000.0000');
  assert.equal(payoutAmount(bets[1].bet, outcome).toFixed(4), '1500.0000');
  assert.equal(payoutAmount(bets[2].bet, outcome).toFixed(4), '900.0000');
  assert.equal(payoutAmount(bets[3].bet, outcome).toFixed(4), '900.0000');
  assert.equal(payoutAmount(bets[4].bet, outcome).toFixed(4), '30.0000');
  assert.equal(payoutAmount(bets[5].bet, outcome).toFixed(4), '0.0000');
  assert.equal(payoutAmount(bets[6].bet, outcome).toFixed(4), '40.0000');
  assert.equal(payoutAmount(bets[7].bet, outcome).toFixed(4), '0.0000');

  const payouts = payoutsByUser(bets, outcome);
  assert.deepEqual(
    payouts.map((row) => `${row.userId}:${row.amount.toFixed(4)}`),
    ['member-a:10500.0000', 'member-b:1800.0000', 'member-c:70.0000'],
  );
  const lines = buildPayoutLedger(payouts);
  const totals = assertBalanced(lines);
  assert.equal(totals.debit.toFixed(4), '12370.0000');
  assert.equal(totals.credit.toFixed(4), '12370.0000');
  const second = buildPayoutLedger(payoutsByUser(bets, outcome));
  assert.deepEqual(
    second.map((line) => `${line.accountCode}:${line.debit.toFixed(4)}:${line.credit.toFixed(4)}`),
    lines.map((line) => `${line.accountCode}:${line.debit.toFixed(4)}:${line.credit.toFixed(4)}`),
  );
});

test('permutation matches any digit order and identical digits still pay the perm rate', () => {
  const shuffled = payoutAmount({ type: 'PERM_3', number: '211', amount: new Decimal('10.0000') }, { top3: '121', bottom2: '00' });
  assert.equal(shuffled.toFixed(4), '1500.0000');
  const same = payoutAmount({ type: 'PERM_3', number: '777', amount: new Decimal('2.0000') }, { top3: '777', bottom2: '77' });
  assert.equal(same.toFixed(4), '300.0000');
});

test('orders reject a number whose length does not match the selection type', () => {
  assert.throws(
    () => canonicalizeItems({ pad: 3, stakeAmounts: stakes }, [{ type: 'TOP_3', number: '12', amount: '10.0000' }]),
    /INVALID_ITEM/,
  );
  assert.throws(
    () => canonicalizeItems({ pad: 2, stakeAmounts: stakes }, [{ type: 'PERM_3', number: '123', amount: '10.0000' }]),
    /INVALID_ITEM/,
  );
  const kept = canonicalizeItems({ pad: 2, stakeAmounts: stakes }, [{ type: 'BOTTOM_2', number: '45', amount: '20.0000' }]);
  assert.equal(kept.items[0]?.amount, '20.0000');
  assert.equal(kept.total.toFixed(4), '20.0000');
  const free = canonicalizeItems({ pad: 3, stakeAmounts: stakes }, [{ type: 'TOP_3', number: '123', amount: '123.5000' }]);
  assert.equal(free.items[0]?.amount, '123.5000');
  assert.throws(
    () => canonicalizeItems({ pad: 3, stakeAmounts: stakes }, [{ type: 'TOP_3', number: '123', amount: '10.0010' }]),
    /INVALID_AMOUNT/,
  );
});

test('national and lao schedules use the server clock in Asia/Bangkok', () => {
  const nation = CATEGORY_SEEDS.find((category) => category.code === 'TH_NATION_D3');
  const lao = CATEGORY_SEEDS.find((category) => category.code === 'LA_DEVELOP');
  assert.ok(nation && lao);
  const beforeDraw = new Date('2026-11-09T08:00:00.000Z');
  const nationNext = nextSession(parseSchedule(nation.schedule), beforeDraw);
  assert.equal(nationNext?.cutoffAt.toISOString(), '2026-11-16T08:30:00.000Z');
  const laoNext = nextSession(parseSchedule(lao.schedule), beforeDraw);
  assert.equal(laoNext?.cutoffAt.toISOString(), '2026-11-09T13:00:00.000Z');
  const afterLao = nextSession(parseSchedule(lao.schedule), new Date('2026-11-09T14:00:00.000Z'));
  assert.equal(afterLao?.cutoffAt.toISOString(), '2026-11-11T13:00:00.000Z');
});

test('settlement does not update a confirmed coupon transaction', () => {
  const source = readFileSync(new URL('../src/coupons/coupon-category.service.ts', import.meta.url), 'utf8');
  const trigger = readFileSync(
    new URL('../prisma/migrations/20261109000000_init/migration.sql', import.meta.url),
    'utf8',
  );
  assert.equal(source.includes('couponTx.update'), false);
  assert.equal(source.includes('couponTx.delete'), false);
  assert.match(trigger, /block_confirmed_tx_modifications/);
  assert.match(trigger, /CONFIRMED', 'SETTLED'/);
});

function bet(userId: string, type: 'TOP_3' | 'PERM_3' | 'TOP_2' | 'BOTTOM_2' | 'SINGLE_TOP' | 'SINGLE_BOTTOM' | 'RUNNING_MIX', number: string, amount: string) {
  return { userId, bet: { type, number, amount: new Decimal(amount) } };
}
