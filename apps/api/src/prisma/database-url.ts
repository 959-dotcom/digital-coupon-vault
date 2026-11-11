import pg from 'pg';

const DIRECT_HOST = /^db\.([a-z0-9]{20})\.supabase\.co$/i;
const POOLER_HOSTS = [
  'aws-0-ap-southeast-1.pooler.supabase.com',
  'aws-1-ap-southeast-1.pooler.supabase.com',
];

// The direct host db.<ref>.supabase.co publishes only an IPv6 address.
// Vercel functions are IPv4, so that host never connects. The shared pooler
// in ap-southeast-1 is IPv4. Session mode (port 5432) keeps prepared statements.
export function poolerCandidates(databaseUrl: string): string[] {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return [databaseUrl];
  }
  const match = parsed.hostname.match(DIRECT_HOST);
  if (!match) {
    return [databaseUrl];
  }
  const ref = match[1].toLowerCase();
  const user = decodeURIComponent(parsed.username);
  if (user !== 'postgres' && user !== `postgres.${ref}`) {
    return [databaseUrl];
  }
  return POOLER_HOSTS.map((host) => {
    const next = new URL(databaseUrl);
    next.username = `postgres.${ref}`;
    next.hostname = host;
    next.port = '5432';
    if (!next.searchParams.has('sslmode')) {
      next.searchParams.set('sslmode', 'require');
    }
    return next.toString();
  });
}

export async function resolveDatabaseUrl(databaseUrl: string): Promise<string> {
  const candidates = poolerCandidates(databaseUrl);
  if (candidates.length === 1) {
    return candidates[0];
  }
  let last: unknown;
  for (const connectionString of candidates) {
    const client = new pg.Client({ connectionString, connectionTimeoutMillis: 4000 });
    try {
      await client.connect();
      await client.end();
      return connectionString;
    } catch (error) {
      last = error;
      await client.end().catch(() => undefined);
    }
  }
  const message = last instanceof Error ? last.message : 'database unreachable';
  throw new Error(message.replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgresql://[redacted]'));
}
