import { copy, translateError } from './copy';
import { useAuth } from './auth-store';
import type {
  BalanceView,
  CategoryView,
  AuditPage,
  CommissionReport,
  LedgerAudit,
  LoginResponse,
  NotificationInbox,
  OrderReceipt,
  OrgChartNode,
  PartnerNode,
  SelectionType,
  SettleResult,
  PointLine,
  TransactionView,
  WithdrawalView,
  LineNode,
  BillListItem,
  BillSlice,
  ReportRow,
  ProductRow,
  StaffRow,
  StaffInput,
  AdminWithdrawal,
} from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = useAuth.getState().token;
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  let response: Response;
  try {
    response = await fetch(`/api/bff${path}`, { ...init, headers, cache: 'no-store' });
  } catch {
    throw new ApiError(0, copy.errors.network);
  }
  const text = await response.text();
  let payload: { message?: unknown } = {};
  if (text) {
    try {
      payload = JSON.parse(text) as { message?: unknown };
    } catch {
      throw new ApiError(response.status, copy.errors.generic);
    }
  }
  if (response.status === 401 && path !== '/auth/login') {
    useAuth.getState().clear();
  }
  if (!response.ok) {
    throw new ApiError(response.status, translateError(payload.message));
  }
  return payload as T;
}

export const api = {
  login(body: { email: string; password: string }) {
    return request<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) });
  },
  register(body: { email: string; password: string; displayName: string; ref: string }) {
    return request<{ id: string; email: string; role: string }>('/auth/register', { method: 'POST', body: JSON.stringify(body) });
  },
  referral() {
    return request<{ code: string; path: string }>('/me/referral');
  },
  holdBar() {
    return request<{
      adminBasePercent: string;
      percentLockMode: 'ADMIN_LOCK' | 'SELF_MANAGE';
      uplineHolds: Array<{ id: string; displayName: string; holdPercent: string }>;
      ownHoldPercent: string;
      remainingDownlineQuota: string;
      maxOwnHold: string;
      canEditOwn: boolean;
    }>('/me/hold');
  },
  network() {
    return request<LineNode[]>('/network');
  },
  createDownline(body: { email: string; password: string; displayName: string; commissionOnly: boolean }) {
    return request<{ id: string; email: string; role: string; referralCode: string }>('/network/downline', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  updateHold(id: string, holdPercent: string) {
    return request<{ id: string; holdPercent: string }>(`/network/${id}/hold`, {
      method: 'PATCH',
      body: JSON.stringify({ holdPercent }),
    });
  },
  updateAccountMode(id: string, commissionOnly: boolean) {
    return request<{ id: string; commissionOnly: boolean }>(`/network/${id}/mode`, {
      method: 'PATCH',
      body: JSON.stringify({ commissionOnly }),
    });
  },
  updateSystemSettings(body: { adminBasePercent: string; percentLockMode: 'ADMIN_LOCK' | 'SELF_MANAGE' }) {
    return request<{ adminBasePercent: string; percentLockMode: string }>('/system/settings', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  bills() {
    return request<BillListItem[]>('/bills');
  },
  bill(id: string) {
    return request<BillSlice>(`/bills/${id}`);
  },
  report(preset: 'today' | '3' | '7' | '30' | 'custom', from?: string, to?: string) {
    const params = new URLSearchParams({ preset });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return request<{ rows: ReportRow[] }>(`/reports?${params.toString()}`);
  },
  products() {
    return request<ProductRow[]>('/products');
  },
  setProduct(code: string, isActive: boolean) {
    return request<{ code: string; isActive: boolean }>(`/products/${code}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  },
  staff() {
    return request<StaffRow[]>('/staff');
  },
  createStaff(body: StaffInput) {
    return request<{ id: string }>('/staff', { method: 'POST', body: JSON.stringify(body) });
  },
  mintCredit(amount: string) {
    return request<{ id: string; amount: string }>('/credit/mint', { method: 'POST', body: JSON.stringify({ amount }) });
  },
  transferCredit(receiverId: string, amount: string) {
    return request<{ id: string; receiverId: string | null; amount: string }>('/credit/transfer', {
      method: 'POST',
      body: JSON.stringify({ receiverId, amount }),
    });
  },
  categories() {
    return request<CategoryView[]>('/api/v1/categories');
  },
  category(id: string) {
    return request<CategoryView>(`/api/v1/categories/${id}`);
  },
  order(
    body: { categoryId: string; batchId: string; items: Array<{ type: SelectionType; number: string; amount: string }> },
    idempotencyKey: string,
  ) {
    return request<OrderReceipt>('/coupons/orders', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'idempotency-key': idempotencyKey },
    });
  },
  settle(body: { batchId: string; top3: string; bottom2: string }) {
    return request<SettleResult>('/api/v1/admin/batches/settle', { method: 'POST', body: JSON.stringify(body) });
  },
  transactions() {
    return request<TransactionView[]>('/me/transactions');
  },
  balance() {
    return request<BalanceView>('/me/balance');
  },
  withdrawals() {
    return request<WithdrawalView[]>('/me/withdrawals');
  },
  withdraw(body: { amount: string; destination: string }) {
    return request<WithdrawalView>('/me/withdrawals', { method: 'POST', body: JSON.stringify(body) });
  },
  adminWithdrawals() {
    return request<AdminWithdrawal[]>('/admin/withdrawals');
  },
  approveWithdrawal(id: string) {
    return request<WithdrawalView>(`/admin/withdrawals/${id}/approve`, { method: 'POST' });
  },
  rejectWithdrawal(id: string) {
    return request<WithdrawalView>(`/admin/withdrawals/${id}/reject`, { method: 'POST' });
  },
  pointLedger() {
    return request<PointLine[]>('/me/ledger');
  },
  hierarchy() {
    return request<PartnerNode[]>('/partners/hierarchy');
  },
  orgChart() {
    return request<OrgChartNode[]>('/partners/tree');
  },
  commissionReport(from: string, to: string) {
    return request<CommissionReport>(`/partners/reports/commission?from=${from}&to=${to}`);
  },
  auditLogs(query: string, page: number) {
    const params = new URLSearchParams({ q: query, page: String(page) });
    return request<AuditPage>(`/admin/audit-logs?${params.toString()}`);
  },
  notifications() {
    return request<NotificationInbox>('/me/notifications');
  },
  readNotification(id: string) {
    return request<{ id: string; readAt: string | null }>(`/me/notifications/${id}/read`, { method: 'POST' });
  },
  readAllNotifications() {
    return request<{ unread: number }>('/me/notifications/read-all', { method: 'POST' });
  },
  updateCommercial(id: string, body: { distributionMode: string; commissionRates: Record<string, string> }) {
    return request<PartnerNode>(`/partners/${id}/commercial`, { method: 'PATCH', body: JSON.stringify(body) });
  },
  ledger(page: number) {
    return request<LedgerAudit>(`/ledger/audit?page=${page}&pageSize=8`);
  },
};
