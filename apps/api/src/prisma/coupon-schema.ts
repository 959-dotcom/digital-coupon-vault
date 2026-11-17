/** Hub Supabase project aozoakeghslgnhdegdyr. Not a secret. */
export const HUB_PROJECT_REF = 'aozoakeghslgnhdegdyr';

/** Coupon tables live here. Hub tables stay in public. DM-CK stays in dmck. */
export const COUPON_SCHEMA = 'coupon';

/**
 * coupon is first so unqualified tables resolve there.
 * public stays second so the ltree type resolves when that extension
 * already lives in public. Quoted PascalCase coupon tables do not match
 * hub tables in public.
 */
export const COUPON_SEARCH_PATH = '"coupon", "public"';

/**
 * True when a Postgres URL is the Hub project.
 * The ref is in the direct host (db.<ref>.supabase.co) or the pooler user
 * (postgres.<ref>). Other databases, including the previous coupon database, stay false.
 */
export function isHubProjectDatabaseUrl(url: string | undefined | null): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed === '') return false;
  return trimmed.includes(HUB_PROJECT_REF);
}

/** `coupon` on the Hub project. `public` on the previous database and local Postgres. */
export function databaseSchema(url: string | undefined | null): 'coupon' | 'public' {
  return isHubProjectDatabaseUrl(url) ? 'coupon' : 'public';
}
