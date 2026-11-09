import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseOracleBody, parseOracleSourceUrls } from '../src/oracle/oracle-parse.js';

test('an empty oracle source list is a no-op and HTML keeps only declared outcome fields', () => {
  assert.deepEqual(parseOracleSourceUrls(undefined), []);
  assert.deepEqual(parseOracleSourceUrls('  '), []);

  const json = parseOracleBody(
    JSON.stringify({
      verified: true,
      categoryCode: 'TH_NATION_D3',
      batchDate: '2026-11-16',
      slot: '15:30',
      top3: '123',
      bottom2: '45',
      password: 'do-not-keep',
    }),
    'application/json',
  );
  assert.deepEqual(json, {
    verified: true,
    categoryCode: 'TH_NATION_D3',
    batchDate: '2026-11-16',
    slot: '15:30',
    top3: '123',
    bottom2: '45',
  });
  assert.equal(JSON.stringify(json).includes('password'), false);

  const html = parseOracleBody(
    '<p>top3 999 bottom2 00 password hunter2</p><section data-verified="true" data-category="TH_NATION_D3" data-batch-date="2026-11-16" data-slot="15:30" data-top3="123" data-bottom2="45" data-password="hunter2">x</section>',
    'text/html',
  );
  assert.equal(html?.top3, '123');
  assert.equal(html?.bottom2, '45');
  assert.equal(html?.verified, true);
  assert.equal(JSON.stringify(html).includes('hunter2'), false);

  const unverified = parseOracleBody(
    '<section data-verified="false" data-category="TH_NATION_D3" data-batch-date="2026-11-16" data-slot="15:30" data-top3="123" data-bottom2="45"></section>',
    'text/html',
  );
  assert.equal(unverified?.verified, false);

  const service = readFileSync(new URL('../src/oracle/external-result-oracle.service.ts', import.meta.url), 'utf8');
  assert.match(service, /ORACLE_SOURCE_URLS is empty; oracle job no-op/);
  assert.equal(service.includes('Authorization'), false);
  assert.equal(service.includes('couponTx.update'), false);
});
