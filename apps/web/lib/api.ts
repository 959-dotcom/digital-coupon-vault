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
