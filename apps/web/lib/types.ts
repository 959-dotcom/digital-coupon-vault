export type RoleName = 'SUPER_ADMIN' | 'MASTER_PARTNER' | 'PARTNER' | 'MEMBER';

export type SessionUser = {
  userId: string;
  email: string;
  role: RoleName;
  partnerId: string | null;
  displayName: string;
  commissionOnly?: boolean;
  isStaff?: boolean;
  permissions?: {
    viewBalance: boolean;
    viewReports: 'all' | 'downline' | 'none';
    manageCredit: boolean;
    manageMembers: boolean;
  } | null;
};

export type LineNode = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  referralCode: string;
  holdPercent: string;
  commissionOnly: boolean;
  credit: string;
  sales: string;
  commission: string;
  children: LineNode[];
};

export type BillListItem = {
  id: string;
  totalAmount: string;
  status: string;
  createdAt: string;
  buyerName: string;
  own: boolean;
};

export type BillSlice = {
  id: string;
  totalAmount: string;
  status: string;
  receivedFromBelow: string;
  ownHold: string;
  sentUpward: string;
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

export type ProductRow = {
  code: string;
  name: string;
  isActive: boolean;
  ownActive: boolean;
};

export type StaffRow = {
  id: string;
  email: string;
  displayName: string;
  permissions: NonNullable<SessionUser['permissions']>;
};

export type StaffInput = {
  email: string;
  password: string;
  displayName: string;
  viewBalance: boolean;
  viewReports: 'all' | 'downline' | 'none';
  manageCredit: boolean;
  manageMembers: boolean;
};

export type LoginResponse = {
  accessToken: string;
  user: SessionUser;
};

export type SelectionType = 'TOP_3' | 'PERM_3' | 'TOP_2' | 'BOTTOM_2' | 'SINGLE_TOP' | 'SINGLE_BOTTOM' | 'RUNNING_MIX';
export type CategoryGroup = 'NATIONAL' | 'REGIONAL' | 'FLASH' | 'STOCK';

export type BatchView = {
  id: string;
  batchDate: string;
  slot: string;
  label: string;
  isOpen: boolean;
  settled: boolean;
  pastCutoff: boolean;
  cutoffAt: string;
};

export type CategoryView = {
  id: string;
  code: string;
  name: string;
  description: string;
  cutoffTime: string;
  group: CategoryGroup;
  gridMin: number;
  gridMax: number;
  pad: number;
  stakeAmounts: string[];
  countdownSeconds: number;
  nextCutoffAt: string | null;
  batches: BatchView[];
};

export type VaultItem = {
  type: SelectionType;
  number: string;
  amount: string;
};

export type OrderReceipt = {
  id: string;
  status: string;
  txHash: string;
  totalAmount: string;
  items: VaultItem[];
  createdAt: string;
  confirmedAt: string | null;
  vaultValid: boolean;
  categoryCode: string;
  categoryId: string;
  batchId: string;
};

export type TransactionView = {
  id: string;
  status: string;
  totalAmount: string;
  txHash: string;
  items: VaultItem[];
  createdAt: string;
  confirmedAt: string | null;
  vaultValid: boolean;
  categoryCode: string;
  categoryName: string;
  batchId: string;
};

export type SettleResult = {
  batchId: string;
  settled: boolean;
  outcome: { top3: string; bottom2: string };
  payouts: Array<{ userId: string; amount: string }>;
};

export type WithdrawalView = {
  id: string;
  amount: string;
  destination: string;
  status: string;
  createdAt: string;
};

export type AdminWithdrawal = WithdrawalView & {
  member: string;
  email: string;
};

export type PointLine = {
  id: string;
  accountCode: string;
  debit: string;
  credit: string;
  memo: string;
  createdAt: string;
  running: string;
};

export type BalanceView = {
  accountCode: string;
  available: string;
};

export type OrgChartNode = {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  path: string;
  distributionMode: 'COMMISSION_ONLY' | 'FULL_PASS' | 'SPLIT_KEEP';
  commissionRates: Record<string, string>;
  isActive: boolean;
  childPartnerCount: number;
  activeMemberCount: number;
  pointsFlow: string;
  children: OrgChartNode[];
};

export type CommissionReport = {
  from: string;
  to: string;
  total: string;
  byDay: Array<{ date: string; amount: string }>;
  byBatch: Array<{ batchId: string; label: string; categoryName: string; amount: string }>;
};

export type AuditRow = {
  id: string;
  actorId: string | null;
  action: string;
  target: string;
  detail: unknown;
  createdAt: string;
};

export type AuditPage = {
  page: number;
  pageSize: number;
  total: number;
  query: string;
  rows: AuditRow[];
};

export type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export type NotificationInbox = {
  unread: number;
  rows: NotificationRow[];
};

export type PartnerNode = {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  path: string;
  distributionMode: 'COMMISSION_ONLY' | 'FULL_PASS' | 'SPLIT_KEEP';
  commissionRates: Record<string, string>;
  isActive: boolean;
  children: PartnerNode[];
};

export type LedgerLine = {
  id: string;
  accountType: 'ASSET' | 'LIABILITY' | 'REVENUE' | 'EXPENSE';
  accountCode: string;
  debit: string;
  credit: string;
  memo: string;
  createdAt: string;
};

export type LedgerGroup = {
  transactionId: string;
  txHash: string | null;
  status: string | null;
  totalAmount: string | null;
  totalDebit: string;
  totalCredit: string;
  balanced: boolean;
  entries: LedgerLine[];
};

export type LedgerAudit = {
  page: number;
  pageSize: number;
  total: number;
  grandDebit: string;
  grandCredit: string;
  balanced: boolean;
  rows: LedgerGroup[];
};
