const STATUS: Record<string, number> = {
  INVALID_CREDENTIALS: 401,
  HMAC_INVALID: 401,
  HMAC_EXPIRED: 401,
  HMAC_NONCE_REUSED: 401,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  PARTNER_SCOPE: 403,
  NOT_ATTACHED: 403,
  INVALID_AMOUNT: 400,
  INVALID_ITEM: 400,
  UNKNOWN_CATEGORY: 400,
  BAD_CUTOFF: 400,
  CATEGORY_INACTIVE: 409,
  BATCH_CLOSED: 409,
  BATCH_NOT_FOUND: 404,
  BATCH_SETTLED: 409,
  PARTNER_INACTIVE: 409,
  USER_INACTIVE: 409,
  INSUFFICIENT_BALANCE: 409,
  WALLET_BUSY: 409,
  ORDER_CANCELLED: 409,
  PARTNER_IN_USE: 409,
  CONFLICT: 409,
  HOLD_CAP: 409,
  HOLD_LOCKED: 403,
  NOT_DIRECT_CHILD: 403,
  COMMISSION_ONLY: 403,
  INVALID_REF: 400,
  BILL_HIDDEN: 404,
  PRODUCT_CLOSED: 409,
  CUTOFF_PASSED: 422,
  UNBALANCED_LEDGER: 500,
  RESERVE_FAILED: 500,
  VAULT_MISMATCH: 500,
  RATE_LIMITED: 429,
  DEPOSITS_CLOSED: 409,
  DEPOSIT_BUSY: 409,
  DEPOSIT_EXPIRED: 409,
  SLIP_REUSED: 409,
  BAD_PIN: 401,
  PIN_MISMATCH: 400,
  BAD_PHONE: 400,
  DEPOSIT_UNMATCHED: 404,
};

export class DomainError extends Error {
  readonly status: number;

  constructor(readonly code: string) {
    super(code);
    this.name = 'DomainError';
    this.status = STATUS[code] ?? 400;
  }
}

export function asDomainError(error: unknown): DomainError | null {
  if (error instanceof DomainError) {
    return error;
  }
  if (error instanceof Error && error.message in STATUS) {
    return new DomainError(error.message);
  }
  return null;
}

export const KNOWN_ERROR_CODES = Object.keys(STATUS);
