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

test('a session pooler URL and a local URL are left unchanged', () => {
  const pooler = 'postgresql://postgres.abcdefghijklmnopqrst:secret@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
  const local = 'postgresql://postgres:secret@127.0.0.1:5432/vantage?schema=public';
  assert.deepEqual(poolerCandidates(pooler), [pooler]);
  assert.deepEqual(poolerCandidates(local), [local]);
});

test('transaction pooler port 6543 becomes session port 5432 without dropping the user or a colon', () => {
  const raw = 'postgresql://postgres.abcdefghijklmnopqrst:se:cret@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true';
  const candidates = poolerCandidates(raw);
  assert.equal(candidates.length, 1);
  const parsed = new URL(candidates[0]);
  assert.equal(parsed.username, 'postgres.abcdefghijklmnopqrst');
  assert.equal(parsed.username.includes('.'), true);
  assert.equal(decodeURIComponent(parsed.password), 'se:cret');
  assert.equal(parsed.port, '5432');
  assert.equal(parsed.hostname, 'aws-1-ap-southeast-1.pooler.supabase.com');
  assert.equal(parsed.searchParams.get('pgbouncer'), null);
});

test('a hash in the password is encoded instead of being treated as a URL fragment', () => {
  const raw = 'postgresql://postgres.abcdefghijklmnopqrst:se#cret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';
  const parsed = new URL(poolerCandidates(raw)[0]);
  assert.equal(parsed.username, 'postgres.abcdefghijklmnopqrst');
  assert.equal(decodeURIComponent(parsed.password), 'se#cret');
  assert.equal(parsed.port, '5432');
});
