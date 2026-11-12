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
    assert.equal(parsed.searchParams.get('uselibpqcompat'), 'true');
    assert.equal(parsed.hostname.includes(ref), false);
  }
});

test('a different pooler user is replaced and the password, port, and pgbouncer flag stay', () => {
  const raw = 'postgresql://postgres.abcdefghijklmnopqrst:se:cret@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true';
  const local = 'postgresql://postgres:secret@127.0.0.1:5432/vantage?schema=public';
  assert.deepEqual(poolerCandidates(local), [local]);
  const parsed = new URL(poolerCandidates(raw)[0]);
  assert.equal(parsed.username, 'postgres.ztrxeqlgiahjoeootqqh');
  assert.equal(decodeURIComponent(parsed.password), 'se:cret');
  assert.equal(parsed.port, '6543');
  assert.equal(parsed.searchParams.get('pgbouncer'), 'true');
});

test('the named pooler user is left unchanged', () => {
  const pooler = 'postgresql://postgres.ztrxeqlgiahjoeootqqh:se:cret@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true';
  assert.deepEqual(poolerCandidates(pooler), [pooler]);
});

test('sslmode=require keeps the pooler password and uses libpq compatibility', () => {
  const raw = 'postgresql://postgres.ztrxeqlgiahjoeootqqh:se:cret@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require';
  const parsed = new URL(poolerCandidates(raw)[0]);
  assert.equal(parsed.username, 'postgres.ztrxeqlgiahjoeootqqh');
  assert.equal(decodeURIComponent(parsed.password), 'se:cret');
  assert.equal(parsed.port, '6543');
  assert.equal(parsed.searchParams.get('pgbouncer'), 'true');
  assert.equal(parsed.searchParams.get('sslmode'), 'require');
  assert.equal(parsed.searchParams.get('uselibpqcompat'), 'true');
});
