export const ORACLE_OUTCOME_FIELDS = ['top3', 'bottom2'] as const;

const HTML_ATTRIBUTES = ['data-verified', 'data-category', 'data-batch-date', 'data-slot', 'data-top3', 'data-bottom2'] as const;

export type OracleReading = {
  categoryCode: string;
  batchDate: string;
  slot: string;
  top3: string;
  bottom2: string;
  verified: boolean;
};

export function parseOracleSourceUrls(raw: string | undefined): string[] {
  if (!raw || raw.trim().length === 0) {
    return [];
  }
  const urls: string[] = [];
  for (const part of raw.split(',')) {
    const candidate = part.trim();
    if (candidate.length === 0) {
      continue;
    }
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      continue;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      continue;
    }
    urls.push(candidate);
  }
  return urls;
}

export function sourceHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'invalid-source';
  }
}

export function parseOracleBody(body: string, contentType: string): OracleReading | null {
  const media = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (media === 'application/json' || media === 'text/json' || (media.length === 0 && looksLikeJson(body))) {
    return parseOracleJson(body);
  }
  if (media === 'text/html' || media === 'application/xhtml+xml' || (media.length === 0 && /<[a-z!/]/i.test(body))) {
    return parseOracleHtml(body);
  }
  return null;
}

function parseOracleJson(body: string): OracleReading | null {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const top3 = readDigits(row.top3, 3);
  const bottom2 = readDigits(row.bottom2, 2);
  const categoryCode = readToken(row.categoryCode);
  const batchDate = readToken(row.batchDate);
  const slot = readToken(row.slot);
  if (!top3 || !bottom2 || !categoryCode || !batchDate || !slot) {
    return null;
  }
  return {
    categoryCode,
    batchDate,
    slot,
    top3,
    bottom2,
    verified: row.verified === true,
  };
}

function parseOracleHtml(html: string): OracleReading | null {
  const tag = html.match(/<[a-z0-9:-]+[^>]*\bdata-top3="\d{3}"[^>]*>/i);
  if (!tag) {
    return null;
  }
  const attrs = declaredAttributes(tag[0]);
  const top3 = readDigits(attrs['data-top3'], 3);
  const bottom2 = readDigits(attrs['data-bottom2'], 2);
  const categoryCode = readToken(attrs['data-category']);
  const batchDate = readToken(attrs['data-batch-date']);
  const slot = readToken(attrs['data-slot']);
  if (!top3 || !bottom2 || !categoryCode || !batchDate || !slot) {
    return null;
  }
  return {
    categoryCode,
    batchDate,
    slot,
    top3,
    bottom2,
    verified: attrs['data-verified'] === 'true',
  };
}

function declaredAttributes(tag: string): Partial<Record<(typeof HTML_ATTRIBUTES)[number], string>> {
  const found: Partial<Record<(typeof HTML_ATTRIBUTES)[number], string>> = {};
  for (const name of HTML_ATTRIBUTES) {
    const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'));
    if (match?.[1]) {
      found[name] = match[1];
    }
  }
  return found;
}

function looksLikeJson(body: string): boolean {
  const trimmed = body.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

function readDigits(value: unknown, length: number): string | null {
  if (typeof value !== 'string' || !new RegExp(`^\\d{${length}}$`).test(value)) {
    return null;
  }
  return value;
}

function readToken(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 80) {
    return null;
  }
  return trimmed;
}
