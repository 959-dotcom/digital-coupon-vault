'use client';

import { useQuery } from '@tanstack/react-query';
import { StatePanel } from '@/components/state-panel';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { copy, statusLabel } from '@/lib/copy';

export default function HistoryPage() {
  const deposits = useQuery({ queryKey: ['deposits'], queryFn: () => api.deposits() });
  const withdrawals = useQuery({ queryKey: ['withdrawals'], queryFn: () => api.withdrawals() });
  const empty = deposits.isSuccess && withdrawals.isSuccess && deposits.data.length === 0 && withdrawals.data.length === 0;
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{copy.history.title}</h1>
      {deposits.isLoading || withdrawals.isLoading ? <StatePanel title={copy.states.loading} /> : null}
      {empty ? <StatePanel title={copy.history.empty} /> : null}
      {deposits.data?.map((row) => (
        <Card key={row.id} className="p-4">
          <p className="text-sm text-white/60">{copy.history.deposit}</p>
          <p className="font-mono text-lg">{row.amount}</p>
          <p className="text-sm">{statusText(row.status)}</p>
        </Card>
      ))}
      {withdrawals.data?.map((row) => (
        <Card key={row.id} className="p-4">
          <p className="text-sm text-white/60">{copy.history.withdraw}</p>
          <p className="font-mono text-lg">{row.amount}</p>
          <p className="text-sm">{statusLabel(row.status)}</p>
          <p className="text-xs text-white/50">{row.destination}</p>
        </Card>
      ))}
    </section>
  );
}

function statusText(status: string): string {
  if (status === 'PENDING') return copy.deposit.pending;
  if (status === 'REVIEW') return copy.deposit.review;
  if (status === 'PAID') return copy.deposit.paid;
  if (status === 'REJECTED') return copy.deposit.rejected;
  if (status === 'EXPIRED') return copy.deposit.expired;
  return statusLabel(status);
}
