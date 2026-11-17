import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { COUPON_SCHEMA, COUPON_SEARCH_PATH, isHubProjectDatabaseUrl } from './coupon-schema.js';

const SEARCH_PATH_SQL = `SET LOCAL search_path TO ${COUPON_SEARCH_PATH}`;

type QueryClient = pg.PoolClient & { __couponSearchPath?: boolean };
type QueryCallback = (err: unknown, result?: unknown) => void;

function queryText(config: unknown): string {
  if (typeof config === 'string') return config.trim();
  if (config && typeof config === 'object' && 'text' in config) {
    const text = (config as { text?: unknown }).text;
    return typeof text === 'string' ? text.trim() : '';
  }
  return '';
}

function usesCouponSchema(text: string): boolean {
  return /"coupon"\s*\./.test(text);
}

/**
 * Pin raw SQL to schema coupon on this pooled client.
 * ORM statements already name "coupon". Transaction-mode poolers drop a
 * session search_path, so each raw statement sets it inside its transaction.
 */
export function attachCouponSearchPath(client: pg.PoolClient): pg.PoolClient {
  const tagged = client as QueryClient;
  if (tagged.__couponSearchPath) return client;
  tagged.__couponSearchPath = true;
  const original = client.query.bind(client);
  const state = { depth: 0 };

  async function run(config: unknown, values: unknown): Promise<unknown> {
    if (config && typeof config === 'object' && typeof (config as { submit?: unknown }).submit === 'function') {
      return original(config as never, values as never);
    }
    const text = queryText(config);
    if (/^BEGIN\b/i.test(text)) {
      const result = await original(config as never, values as never);
      state.depth += 1;
      return result;
    }
    if (/^COMMIT\b/i.test(text) || (/^ROLLBACK\b/i.test(text) && !/^ROLLBACK\s+TO\b/i.test(text))) {
      const result = await original(config as never, values as never);
      state.depth = Math.max(0, state.depth - 1);
      return result;
    }
    if (/^(SAVEPOINT|RELEASE|SET\s+TRANSACTION|ROLLBACK\s+TO)\b/i.test(text)) {
      return original(config as never, values as never);
    }
    if (usesCouponSchema(text)) {
      return original(config as never, values as never);
    }
    if (state.depth === 0) {
      await original('BEGIN');
      try {
        await original(SEARCH_PATH_SQL);
        const result = await original(config as never, values as never);
        await original('COMMIT');
        return result;
      } catch (error) {
        await original('ROLLBACK').catch(() => undefined);
        throw error;
      }
    }
    await original(SEARCH_PATH_SQL);
    return original(config as never, values as never);
  }

  client.query = ((config: unknown, values?: unknown, callback?: unknown) => {
    const cb = (typeof values === 'function' ? values : typeof callback === 'function' ? callback : undefined) as
      | QueryCallback
      | undefined;
    const queryValues = typeof values === 'function' ? undefined : values;
    const promise = run(config, queryValues);
    if (cb) {
      promise.then(
        (result) => cb(undefined, result),
        (error: unknown) => cb(error),
      );
      return undefined;
    }
    return promise;
  }) as typeof client.query;
  return client;
}

export function createPrismaAdapter(connectionString: string): PrismaPg {
  if (!isHubProjectDatabaseUrl(connectionString)) {
    return new PrismaPg({ connectionString });
  }
  const pool = new pg.Pool({ connectionString });
  const connect = pool.connect.bind(pool);
  pool.connect = ((callback?: unknown) => {
    if (typeof callback === 'function') {
      return connect((err: Error | undefined, client: pg.PoolClient | undefined, done: (release?: boolean) => void) => {
        if (client) attachCouponSearchPath(client);
        (callback as (err: Error | undefined, client: pg.PoolClient | undefined, done: (release?: boolean) => void) => void)(
          err,
          client,
          done,
        );
      });
    }
    return Promise.resolve(connect()).then((client) => attachCouponSearchPath(client));
  }) as typeof pool.connect;
  // adapter-pg ships its own @types/pg. The runtime pool is still pg 8.
  return new PrismaPg(pool as never, { schema: COUPON_SCHEMA, disposeExternalPool: true });
}
