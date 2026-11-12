const SECRET_KEY = /password|pin|token|secret/i;

export function redactSecrets(detail: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (SECRET_KEY.test(key)) {
      continue;
    }
    next[key] = value;
  }
  return next;
}
