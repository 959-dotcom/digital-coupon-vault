'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StatePanel } from '@/components/state-panel';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { copy } from '@/lib/copy';

export default function BillsPage() {
  const bills = useQuery({ queryKey: ['bills'], queryFn: () => api.bills() });
  const [selected, setSelected] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ['bill', selected],
    queryFn: () => api.bill(selected ?? ''),
    enabled: Boolean(selected),
  });

  if (bills.isLoading) {
    return <StatePanel title={copy.states.loading} />;
  }
  if (bills.isError) {
    return <StatePanel title={copy.errors.generic} />;
  }
  if (!bills.data || bills.data.length === 0) {
    return <StatePanel title={copy.bills.empty} />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{copy.bills.title}</h1>
      <p className="text-sm text-white/60">{copy.bills.hidden}</p>
      {bills.data.map((bill) => (
        <button key={bill.id} type="button" className="block w-full text-left" onClick={() => setSelected(bill.id)}>
          <Card className="p-4 text-sm">
            <p className="font-medium">{bill.buyerName}</p>
            <p>{copy.bills.total}: {bill.totalAmount}</p>
          </Card>
        </button>
      ))}
      {detail.data ? (
        <Card className="space-y-2 p-4 text-sm">
          <p>{copy.bills.total}: {detail.data.totalAmount}</p>
          <p>{copy.bills.received}: {detail.data.receivedFromBelow}</p>
          <p>{copy.bills.own}: {detail.data.ownHold}</p>
          <p>{copy.bills.sent}: {detail.data.sentUpward}</p>
        </Card>
      ) : null}
    </div>
  );
}
