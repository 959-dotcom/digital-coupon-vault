import pg from 'pg';

const DIRECT_HOST = /^db\.([a-z0-9]{20})\.supabase\.co$/i;
const POOLER_HOST = /^aws-\d+-ap-southeast-1\.pooler\.supabase\.com$/i;
const POOLER_HOSTS = [
  'aws-0-ap-southeast-1.pooler.supabase.com',
  'aws-1-ap-southeast-1.pooler.supabase.com',
];

type Parts = {
  user: string;
  password: string;
  host: string;
  port: string;
  database: string;
  params: URLSearchParams;
};

// Userinfo is split on the first colon only. A dotted pooler user
// (postgres.<ref>) stays intact, and any later colon stays in the password.
// The WHATWG URL parser treats "#" as a fragment and drops the rest of the password.
function splitConnection(databaseUrl: string): Parts | null {
  const match = /^(postgres(?:ql)?:\/\/)([^@]*)@([^/?#]+)([^?#]*)(?:\?([^#]*))?/i.exec(databaseUrl);
  if (!match) {
    return null;
  }
  const userinfo = match[2];
  const colon = userinfo.indexOf(':');
  let user: string;
  let password: string;
  try {
    user = decodeURIComponent(colon === -1 ? userinfo : userinfo.slice(0, colon));
    password = colon === -1 ? '' : decodeURIComponent(userinfo.slice(colon + 1));
  } catch {
    return null;
  }
  const hostport = match[3];
  const portMatch = /:(\d+)$/.exec(hostport);
  const host = portMatch ? hostport.slice(0, -portMatch[0].length) : hostport;
  const port = portMatch ? portMatch[1] : '';
  const database = (match[4] || '/postgres').replace(/^\//, '') || 'postgres';
  return { user, password, host, port, database, params: new URLSearchParams(match[5] || '') };
}

function formatConnection(parts: Parts): string {
  const user = encodeURIComponent(parts.user);
  const auth = parts.password.length > 0 ? `${user}:${encodeURIComponent(parts.password)}` : user;
  const port = parts.port ? `:${parts.port}` : '';
  const query = parts.params.toString();
  return `postgresql://${auth}@${parts.host}${port}/${parts.database}${query ? `?${query}` : ''}`;
}

export function poolerCandidates(databaseUrl: string): string[] {
  const parts = splitConnection(databaseUrl);
  if (!parts) {
    return [databaseUrl];
  }
  const direct = parts.host.match(DIRECT_HOST);
  if (direct) {
    const ref = direct[1].toLowerCase();
    if (parts.user !== 'postgres' && parts.user !== `postgres.${ref}`) {
      return [databaseUrl];
    }
    return POOLER_HOSTS.map((host) => {
      const params = new URLSearchParams(parts.params);
      params.delete('pgbouncer');
      if (!params.has('sslmode')) {
        params.set('sslmode', 'require');
      }
      return formatConnection({
        ...parts,
        user: `postgres.${ref}`,
        host,
        port: '5432',
        params,
      });
    });
  }
  // Transaction mode (6543) rejects Prisma prepared statements. Session mode is 5432.
  // The dotted user and password are copied unchanged.
  if (POOLER_HOST.test(parts.host) && (parts.port === '6543' || parts.params.has('pgbouncer'))) {
    const params = new URLSearchParams(parts.params);
    params.delete('pgbouncer');
    return [formatConnection({ ...parts, port: '5432', params })];
  }
  return [databaseUrl];
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
