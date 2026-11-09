export type RoleName = 'SUPER_ADMIN' | 'MASTER_PARTNER' | 'PARTNER' | 'MEMBER';

export type SessionUser = {
  userId: string;
  email: string;
  role: RoleName;
  partnerId: string | null;
  displayName: string;
};

export type LoginResponse = {
  accessToken: string;
  user: SessionUser;
};

export type BatchView = {
  id: string;
  batchDate: string;
  label: string;
  isOpen: boolean;
  pastCutoff: boolean;
  cutoffAt: string;
};

export type CategoryView = {
  id: string;
  code: string;
  name: string;
  description: string;
  cutoffTime: string;
  gridMin: number;
  gridMax: number;
  pad: number;
  stakeAmounts: string[];
  batches: BatchView[];
};

export type VaultItem = {
  sku: string;
  label: string;
  quantity: string;
  unitAmount: string;
  lineAmount: string;
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

export type BalanceView = {
  accountCode: string;
  available: string;
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
