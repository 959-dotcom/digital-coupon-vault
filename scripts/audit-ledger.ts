import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import pg from 'pg';
import { auditJournals } from '../apps/api/src/ledger/journal-audit.js';

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(process.cwd(), '../../.env') });

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query<{ transactionId: string; debit: string; credit: string }>(
      `SELECT "transactionId", debit::text AS debit, credit::text AS credit FROM "LedgerEntry"`,
    );
    const report = auditJournals(result.rows);
    if (report.mismatches.length > 0) {
      for (const mismatch of report.mismatches) {
        console.error(`mismatch ${mismatch.transactionId} debit=${mismatch.debit} credit=${mismatch.credit}`);
      }
      console.error(`journals=${report.journals} mismatches=${report.mismatches.length}`);
      process.exitCode = 1;
      return;
    }
    console.log(`journals=${report.journals} balanced`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
