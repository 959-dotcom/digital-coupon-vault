'use client';

import { useQuery } from '@tanstack/react-query';
import { StatePanel } from '@/components/state-panel';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { copy, statusLabel } from '@/lib/copy';
import { formatPoints } from '@/lib/money';

export default function OrdersPage() {
  const transactions = useQuery({ queryKey: ['transactions'], queryFn: () => api.transactions() });

  return (
    <section>
      <h1 className="text-2xl font-semibold">{copy.orders.title}</h1>
      <div className="mt-4 space-y-3">
        {transactions.isLoading ? <StatePanel title={copy.catalog.loading} /> : null}
        {transactions.isError ? <StatePanel title={copy.orders.error} onRetry={() => void transactions.refetch()} /> : null}
        {transactions.isSuccess && transactions.data.length === 0 ? <StatePanel title={copy.orders.empty} /> : null}
        {transactions.data?.map((row) => (
          <Card key={row.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{row.categoryName}</p>
                <p className="mt-1 font-mono text-sm">{formatPoints(row.totalAmount)}</p>
              </div>
              <Badge className={row.vaultValid ? 'bg-pine-soft text-pine' : 'bg-danger-soft text-danger'}>
                {statusLabel(row.status)}
              </Badge>
            </div>
            <p className="mt-3 text-[11px] text-ink/50">{copy.orders.hash}</p>
            <p className="break-all font-mono text-[11px] leading-5">{row.txHash}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
