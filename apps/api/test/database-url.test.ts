import assert from 'node:assert/strict';
import test from 'node:test';
import { poolerCandidates } from '../src/prisma/database-url.js';

const ref = 'abcdefghijklmnopqrst';
const direct = `postgresql://postgres:p%40ss@db.${ref}.supabase.co/postgres`;

test('a direct Supabase host becomes the IPv4 session pooler', () => {
  const candidates = poolerCandidates(direct);
  assert.equal(candidates.length, 2);
  for (const [index, candidate] of candidates.entries()) {
    const parsed = new URL(candidate);
    assert.equal(parsed.username, `postgres.${ref}`);
    assert.equal(parsed.hostname, `aws-${index}-ap-southeast-1.pooler.supabase.com`);
    assert.equal(parsed.port, '5432');
    assert.equal(decodeURIComponent(parsed.password), 'p@ss');
    assert.equal(parsed.searchParams.get('sslmode'), 'require');
    assert.equal(parsed.hostname.includes(ref), false);
  }
});

test('a transaction pooler URL and a local URL are left unchanged', () => {
  const pooler = 'postgresql://postgres.abcdefghijklmnopqrst:se:cret@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true';
  const local = 'postgresql://postgres:secret@127.0.0.1:5432/vantage?schema=public';
  assert.deepEqual(poolerCandidates(pooler), [pooler]);
  assert.deepEqual(poolerCandidates(local), [local]);
  const parsed = new URL(pooler);
  assert.equal(parsed.username.includes('.'), true);
  assert.equal(parsed.port, '6543');
  assert.equal(parsed.hostname.split('.')[0], 'aws-1-ap-southeast-1');
  assert.equal(parsed.searchParams.get('pgbouncer'), 'true');
  assert.equal(decodeURIComponent(parsed.password), 'se:cret');
});
