import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import pg from 'pg';
import { poolerCandidates, describeDatabaseUrl } from '../src/prisma/database-url.js';
import { COUPON_SCHEMA, HUB_PROJECT_REF, databaseSchema, isHubProjectDatabaseUrl } from '../src/prisma/coupon-schema.js';
import { attachCouponSearchPath, createPrismaAdapter } from '../src/prisma/prisma-adapter.js';

const DIRECT = `postgresql://postgres:p%40ss@db.${HUB_PROJECT_REF}.supabase.co/postgres`;
const POOLER = `postgresql://postgres.${HUB_PROJECT_REF}:se:cret@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public`;
const PREVIOUS = 'postgresql://postgres.ztrxeqlgiahjoeootqqh:se:cret@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public';

test('hub project detection leaves every other database on public', () => {
  assert.equal(COUPON_SCHEMA, 'coupon');
  assert.equal(isHubProjectDatabaseUrl(DIRECT), true);
  assert.equal(isHubProjectDatabaseUrl(`  ${POOLER}  `), true);
  assert.equal(databaseSchema(POOLER), 'coupon');
  assert.equal(isHubProjectDatabaseUrl(''), false);
  assert.equal(isHubProjectDatabaseUrl('   '), false);
  assert.equal(isHubProjectDatabaseUrl(undefined), false);
  assert.equal(isHubProjectDatabaseUrl(PREVIOUS), false);
  assert.equal(databaseSchema('postgresql://coupon:coupon@localhost:5432/coupon?schema=public'), 'public');
  assert.equal(
    isHubProjectDatabaseUrl('postgresql://postgres:secret@db.fahkknzinragbeizymny.supabase.co:5432/postgres'),
    false,
  );
});

test('a hub pooler URL keeps its user and pins schema coupon', () => {
  const parsed = new URL(poolerCandidates(POOLER)[0]);
  assert.equal(parsed.username, `postgres.${HUB_PROJECT_REF}`);
  assert.equal(decodeURIComponent(parsed.password), 'se:cret');
  assert.equal(parsed.port, '6543');
  assert.equal(parsed.searchParams.get('pgbouncer'), 'true');
  assert.equal(parsed.searchParams.get('schema'), 'coupon');
  assert.equal(describeDatabaseUrl(POOLER).userEquals, true);
});

test('a hub direct host becomes the pooler user for that project', () => {
  const candidates = poolerCandidates(DIRECT);
  assert.equal(candidates.length, 2);
  for (const candidate of candidates) {
    const parsed = new URL(candidate);
    assert.equal(parsed.username, `postgres.${HUB_PROJECT_REF}`);
    assert.equal(parsed.searchParams.get('schema'), 'coupon');
    assert.equal(decodeURIComponent(parsed.password), 'p@ss');
  }
  assert.equal(describeDatabaseUrl(DIRECT).userEquals, true);
});

test('the previous coupon database stays on its pooler user and schema', () => {
  const parsed = new URL(poolerCandidates(PREVIOUS)[0]);
  assert.equal(parsed.username, 'postgres.ztrxeqlgiahjoeootqqh');
  assert.equal(parsed.searchParams.get('schema'), 'public');
  assert.equal(parsed.searchParams.get('pgbouncer'), 'true');
});

test('raw statements on the hub pin search_path inside a transaction', async () => {
  const calls: string[] = [];
  const client = {
    query: async (config: unknown) => {
      calls.push(typeof config === 'string' ? config : JSON.stringify(config));
      return { rows: [] };
    },
  };
  attachCouponSearchPath(client as unknown as pg.PoolClient);
  await client.query('SELECT id FROM "User"');
  await client.query('BEGIN');
  await client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
  await client.query('SELECT "coupon"."Partner"."id" FROM "coupon"."Partner"');
  await client.query('DELETE FROM "RequestNonce" WHERE "expiresAt" < NOW()');
  await client.query('ROLLBACK TO SAVEPOINT s');
  await client.query('SELECT id FROM "LedgerEntry"');
  await client.query('COMMIT');
  assert.deepEqual(calls, [
    'BEGIN',
    'SET LOCAL search_path TO "coupon", "public"',
    'SELECT id FROM "User"',
    'COMMIT',
    'BEGIN',
    'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
    'SELECT "coupon"."Partner"."id" FROM "coupon"."Partner"',
    'SET LOCAL search_path TO "coupon", "public"',
    'DELETE FROM "RequestNonce" WHERE "expiresAt" < NOW()',
    'ROLLBACK TO SAVEPOINT s',
    'SET LOCAL search_path TO "coupon", "public"',
    'SELECT id FROM "LedgerEntry"',
    'COMMIT',
  ]);
});

test('the prisma adapter names schema coupon only for the hub project', async () => {
  const local = createPrismaAdapter('postgresql://coupon:coupon@127.0.0.1:5432/coupon?schema=public');
  assert.equal((local as { options?: { schema?: string } }).options?.schema, undefined);

  const hub = createPrismaAdapter(POOLER);
  assert.equal((hub as { options?: { schema?: string; disposeExternalPool?: boolean } }).options?.schema, 'coupon');
  assert.equal((hub as { options?: { disposeExternalPool?: boolean } }).options?.disposeExternalPool, true);
  await (hub as { externalPool?: pg.Pool }).externalPool?.end();
});

test('hub schema sql builds coupon and does not insert users', () => {
  const sql = readFileSync(new URL('../prisma/hub/coupon_schema.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE SCHEMA IF NOT EXISTS coupon/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS coupon\."User"/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS coupon\."CouponTx"/);
  assert.match(sql, /trg_protect_vault_tx/);
  assert.doesNotMatch(sql, /\binsert\s+into\s+(coupon\.)?"User"/i);
  assert.doesNotMatch(sql, /\b(hub_profiles|user_app_permissions|security_audit_logs)\b/i);
  assert.doesNotMatch(sql, /\bdrop\s+schema\b/i);
  assert.doesNotMatch(sql, /\bcreate\s+(table|schema)\s+(if\s+not\s+exists\s+)?dmck\b/i);
  assert.doesNotMatch(sql, /\bpublic\s*\.\s*"/);
  assert.match(sql, /YEEKEE_10M/);
  assert.match(sql, /ON CONFLICT \("id"\) DO NOTHING/);
});
