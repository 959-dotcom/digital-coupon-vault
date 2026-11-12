import assert from 'node:assert/strict';
import test from 'node:test';
import { allows, closedByAncestor, LOCKED_PERMISSIONS } from '../src/access/permissions.js';
import { parseSchedule } from '../src/coupons/schedule.js';
import { Decimal } from '../src/money/decimal.js';
import { rollupReport } from '../src/reports/report-rollup.js';
import { reportWindow } from '../src/reports/report-window.js';

test('a staff account without balance permission is denied', () => {
  assert.equal(allows(LOCKED_PERMISSIONS, 'balance'), false);
  assert.equal(allows(LOCKED_PERMISSIONS, 'credit'), false);
  assert.equal(allows(LOCKED_PERMISSIONS, 'members'), false);
  assert.equal(allows(LOCKED_PERMISSIONS, 'reports'), false);
  assert.equal(
    allows({ viewBalance: true, viewReports: 'none', manageCredit: false, manageMembers: false }, 'balance'),
    true,
  );
  assert.equal(
    allows({ viewBalance: false, viewReports: 'downline', manageCredit: false, manageMembers: false }, 'reports'),
    true,
  );
});

test('a closed product blocks that line and not a sibling line', () => {
  const flags = [{ userId: 'master', isActive: false }];
  assert.equal(closedByAncestor(flags, ['admin', 'master', 'member']), true);
  assert.equal(closedByAncestor(flags, ['admin', 'other']), false);
  assert.equal(closedByAncestor([{ userId: 'master', isActive: true }], ['admin', 'master']), false);
});

test('a downline report hides the viewer row and a sibling line', () => {
  const bill = new Decimal('100.0000');
  const rows = rollupReport('admin.master', 'downline', [
    {
      buyerId: 'master',
      buyerName: 'มาสเตอร์',
      buyerPath: 'admin.master',
      total: bill,
      shares: [],
    },
    {
      buyerId: 'member',
      buyerName: 'สมาชิก',
      buyerPath: 'admin.master.member',
      total: bill,
      shares: [
        {
          userId: 'member',
          path: 'admin.master.member',
          level: 'member',
          amount: new Decimal('10.0000'),
          sentUpward: new Decimal('90.0000'),
        },
        {
          userId: 'admin',
          path: 'admin',
          level: 'company',
          amount: new Decimal('20.0000'),
          sentUpward: new Decimal('0.0000'),
        },
      ],
    },
    {
      buyerId: 'other',
      buyerName: 'สายอื่น',
      buyerPath: 'admin.other',
      total: bill,
      shares: [],
    },
  ]);
  assert.deepEqual(rows.map((row) => row.username), ['สมาชิก']);
  assert.equal(rows[0]?.member, '10.0000');
  assert.equal(rows[0]?.company, '0.0000');
  assert.equal(rows[0]?.sentUpward, '90.0000');
  assert.equal(rows[0]?.billTotal, '100.0000');
});

test('report days use Asia/Bangkok midnights and the 10 minute yeekee cadence parses', () => {
  const window = reportWindow('today', new Date('2026-11-12T20:00:00.000Z'));
  assert.equal(window.start.toISOString(), '2026-11-12T17:00:00.000Z');
  assert.equal(window.end.toISOString(), '2026-11-13T17:00:00.000Z');
  const schedule = parseSchedule({
    group: 'FLASH',
    weekdays: null,
    daysOfMonth: null,
    sessions: [],
    intervalMinutes: 10,
    batchesPerDay: 143,
  });
  assert.equal(schedule.intervalMinutes, 10);
  assert.equal(schedule.batchesPerDay, 143);
});
