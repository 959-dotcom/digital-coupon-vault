import assert from 'node:assert/strict';
import test from 'node:test';
import { Decimal, ZERO } from '../src/money/decimal.js';
import { holdsWithinCap, isSameOrDescendant, splitHoldWaterfall } from '../src/hierarchy/hold-waterfall.js';

const bill = new Decimal('100.0000');

function person(id: string, hold: string) {
  return { id, holdPercent: new Decimal(hold) };
}

function sumSlices(result: ReturnType<typeof splitHoldWaterfall>): Decimal {
  return [...result.nodes, result.admin].reduce((sum, slice) => sum.plus(slice.amount), ZERO);
}

test('four levels keep 10, 20 and 50, and admin receives the remaining 20', () => {
  const result = splitHoldWaterfall(
    bill,
    new Decimal(5),
    [person('member', '10'), person('partner', '20'), person('master', '50')],
    'admin',
  );
  assert.deepEqual(
    result.nodes.map((slice) => `${slice.id}:${slice.amount.toFixed(4)}`),
    ['member:10.0000', 'partner:20.0000', 'master:50.0000'],
  );
  assert.equal(result.admin.amount.toFixed(4), '20.0000');
  assert.equal(result.admin.receivedFromBelow.toFixed(4), '20.0000');
  assert.equal(result.nodes[0]?.receivedFromBelow.toFixed(4), '100.0000');
  assert.equal(result.nodes[0]?.sentUpward.toFixed(4), '90.0000');
  assert.equal(result.nodes[1]?.receivedFromBelow.toFixed(4), '90.0000');
  assert.equal(result.nodes[1]?.sentUpward.toFixed(4), '70.0000');
  assert.equal(sumSlices(result).toFixed(4), '100.0000');
  assert.equal(result.nodes.some((slice) => slice.id === 'admin'), false);
});

test('five levels still sum exactly to the bill', () => {
  const result = splitHoldWaterfall(
    bill,
    new Decimal('5.00'),
    [
      person('member', '8'),
      person('agent', '7'),
      person('partner', '15'),
      person('master', '40'),
    ],
    'admin',
  );
  assert.equal(result.nodes.length, 4);
  assert.equal(result.admin.amount.toFixed(4), '30.0000');
  assert.equal(sumSlices(result).eq(bill), true);
});

test('a 0% hold is skipped and the amount rolls up', () => {
  const result = splitHoldWaterfall(
    bill,
    new Decimal(5),
    [person('member', '10'), person('partner', '0'), person('master', '50')],
    'admin',
  );
  const partner = result.nodes.find((slice) => slice.id === 'partner');
  assert.ok(partner);
  assert.equal(partner.skipped, true);
  assert.equal(partner.amount.toFixed(4), '0.0000');
  assert.equal(partner.receivedFromBelow.toFixed(4), partner.sentUpward.toFixed(4));
  const master = result.nodes.find((slice) => slice.id === 'master');
  assert.equal(master?.receivedFromBelow.toFixed(4), '90.0000');
  assert.equal(master?.amount.toFixed(4), '50.0000');
  assert.equal(result.admin.amount.toFixed(4), '40.0000');
  assert.equal(sumSlices(result).toFixed(4), '100.0000');
});

test('raising the admin base fee keeps an exact split and rejects an over-cap line', () => {
  const loose = splitHoldWaterfall(
    bill,
    new Decimal(10),
    [person('member', '10'), person('partner', '20'), person('master', '50')],
    'admin',
  );
  assert.equal(loose.admin.amount.toFixed(4), '20.0000');
  assert.equal(loose.admin.amount.gte(bill.mul(10).div(100)), true);
  assert.equal(sumSlices(loose).eq(bill), true);
  assert.equal(holdsWithinCap([new Decimal(10), new Decimal(20), new Decimal(50)], new Decimal(10)), true);
  assert.equal(holdsWithinCap([new Decimal(40), new Decimal(55)], new Decimal(10)), false);
  assert.throws(
    () => splitHoldWaterfall(bill, new Decimal(10), [person('member', '40'), person('partner', '55')], 'admin'),
    /HOLD_CAP/,
  );
});

test('a viewer sees their own line and not a sibling line', () => {
  assert.equal(isSameOrDescendant('admin.master', 'admin.master.shop.member'), true);
  assert.equal(isSameOrDescendant('admin.master.shop', 'admin.master.shop'), true);
  assert.equal(isSameOrDescendant('admin.master.shop', 'admin.master'), false);
  assert.equal(isSameOrDescendant('admin.master.shop', 'admin.master.other'), false);
});
