import { Decimal, ZERO, formatMoney } from '../money/decimal.js';
import { isSameOrDescendant } from '../hierarchy/hold-waterfall.js';

export type AccountLevel = 'member' | 'agent' | 'master' | 'senior' | 'company';

export function accountLevel(role: string, parentRole: string | null): AccountLevel {
  if (role === 'SUPER_ADMIN') {
    return 'company';
  }
  if (role === 'MASTER_PARTNER' && parentRole === 'SUPER_ADMIN') {
    return 'senior';
  }
  if (role === 'MASTER_PARTNER') {
    return 'master';
  }
  if (role === 'PARTNER') {
    return 'agent';
  }
  return 'member';
}

export type ShareBit = {
  userId: string;
  path: string;
  level: AccountLevel;
  amount: Decimal;
  sentUpward: Decimal;
};

export type BillBit = {
  buyerId: string;
  buyerName: string;
  buyerPath: string;
  total: Decimal;
  shares: ShareBit[];
};

export type ReportRow = {
  userId: string;
  username: string;
  member: string;
  agent: string;
  master: string;
  senior: string;
  company: string;
  billTotal: string;
  sentUpward: string;
  commissionReceived: string;
};

export function rollupReport(
  viewerPath: string,
  scope: 'all' | 'downline',
  bills: readonly BillBit[],
): ReportRow[] {
  const grouped = new Map<string, { name: string; total: Decimal; shares: ShareBit[] }>();
  for (const bill of bills) {
    if (!isSameOrDescendant(viewerPath, bill.buyerPath)) {
      continue;
    }
    if (scope === 'downline' && bill.buyerPath === viewerPath) {
      continue;
    }
    const current = grouped.get(bill.buyerId) ?? { name: bill.buyerName, total: ZERO, shares: [] };
    current.total = current.total.plus(bill.total);
    current.shares.push(...bill.shares.filter((share) => isSameOrDescendant(viewerPath, share.path)));
    grouped.set(bill.buyerId, current);
  }
  const rows: ReportRow[] = [];
  for (const [userId, row] of grouped) {
    const levels: Record<AccountLevel, Decimal> = {
      member: ZERO,
      agent: ZERO,
      master: ZERO,
      senior: ZERO,
      company: ZERO,
    };
    let sent = ZERO;
    let received = ZERO;
    for (const share of row.shares) {
      levels[share.level] = levels[share.level].plus(share.amount);
      if (share.userId === userId) {
        received = received.plus(share.amount);
        sent = sent.plus(share.sentUpward);
      }
    }
    rows.push({
      userId,
      username: row.name,
      member: formatMoney(levels.member),
      agent: formatMoney(levels.agent),
      master: formatMoney(levels.master),
      senior: formatMoney(levels.senior),
      company: formatMoney(levels.company),
      billTotal: formatMoney(row.total),
      sentUpward: formatMoney(sent),
      commissionReceived: formatMoney(received),
    });
  }
  return rows;
}
