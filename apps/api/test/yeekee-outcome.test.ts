import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { drawYeekeeOutcome, yeekeeOutcomeFromSeed } from '../src/coupons/yeekee-outcome.js';

test('Yeekee outcome comes from a cryptographic seed and records its hash', () => {
  const seed = Buffer.from('0123456789abcdef0123456789abcdef');
  const first = yeekeeOutcomeFromSeed(seed);
  const second = yeekeeOutcomeFromSeed(seed);
  assert.deepEqual(first, second);
  assert.match(first.top3, /^\d{3}$/);
  assert.match(first.bottom2, /^\d{2}$/);
  assert.equal(first.seedHash, createHash('sha256').update(seed).digest('hex'));

  const other = yeekeeOutcomeFromSeed(Buffer.from('ffffffffffffffffffffffffffffffff'));
  assert.notEqual(other.seedHash, first.seedHash);

  const drawn = drawYeekeeOutcome();
  assert.match(drawn.top3, /^\d{3}$/);
  assert.match(drawn.bottom2, /^\d{2}$/);
  assert.match(drawn.seedHash, /^[0-9a-f]{64}$/);

  const outcome = readFileSync(new URL('../src/coupons/yeekee-outcome.ts', import.meta.url), 'utf8');
  const scheduler = readFileSync(new URL('../src/coupons/yeekee-batch.scheduler.ts', import.meta.url), 'utf8');
  assert.equal(outcome.includes('Math.random'), false);
  assert.equal(scheduler.includes('Math.random'), false);
  assert.match(outcome, /randomBytes/);
  assert.match(scheduler, /drawYeekeeOutcome/);
  assert.match(scheduler, /seedHash/);
  assert.equal(scheduler.includes('couponTx.update'), false);
  assert.equal(scheduler.includes('couponTx.delete'), false);
});
