'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { StatePanel } from '@/components/state-panel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiError, api } from '@/lib/api';
import { copy } from '@/lib/copy';
import { useAuth } from '@/lib/auth-store';

export default function SettlementPage() {
  const user = useAuth((state) => state.user);
  const queryClient = useQueryClient();
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.categories(),
    enabled: user?.role === 'SUPER_ADMIN',
  });
  const [batchId, setBatchId] = useState('');
  const [top3, setTop3] = useState('');
  const [bottom2, setBottom2] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const settle = useMutation({
    mutationFn: () => api.settle({ batchId, top3, bottom2 }),
    onSuccess: async () => {
      setMessage(copy.settlement.done);
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (error: Error) => {
      setMessage(null);
      setFormError(error instanceof ApiError ? error.message : copy.errors.generic);
    },
  });

  if (user?.role !== 'SUPER_ADMIN') {
    return <StatePanel title={copy.settlement.forbidden} />;
  }

  const batches = categories.data?.flatMap((category) =>
    category.batches
      .filter((batch) => !batch.settled)
      .map((batch) => ({ ...batch, categoryName: category.name })),
  ) ?? [];

  return (
    <section>
      <h1 className="text-2xl font-semibold">{copy.settlement.title}</h1>
      <Button asChild variant="outline" size="sm" className="mt-3">
        <Link href="/audit-logs">{copy.settlement.audit}</Link>
      </Button>
      <div className="mt-4 space-y-3">
        {categories.isLoading ? <StatePanel title={copy.catalog.loading} /> : null}
        {categories.isError ? <StatePanel title={copy.settlement.error} onRetry={() => void categories.refetch()} /> : null}
        {categories.isSuccess && batches.length === 0 ? <StatePanel title={copy.settlement.empty} /> : null}
        <Card className="space-y-3 p-4">
          <label className="block text-sm font-medium" htmlFor="settle-batch">
            {copy.settlement.batch}
          </label>
          <select
            id="settle-batch"
            className="h-11 w-full rounded-2xl border border-line bg-paper px-3 text-sm text-white"
            value={batchId}
            onChange={(event) => setBatchId(event.target.value)}
          >
            <option value="">{copy.settlement.batch}</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.categoryName} · {batch.label}
              </option>
            ))}
          </select>
          <label className="block text-sm font-medium" htmlFor="settle-top3">
            {copy.settlement.top3}
          </label>
          <Input
            id="settle-top3"
            inputMode="numeric"
            maxLength={3}
            value={top3}
            className="font-mono"
            onChange={(event) => setTop3(event.target.value.replace(/\D/g, '').slice(0, 3))}
          />
          <label className="block text-sm font-medium" htmlFor="settle-bottom2">
            {copy.settlement.bottom2}
          </label>
          <Input
            id="settle-bottom2"
            inputMode="numeric"
            maxLength={2}
            value={bottom2}
            className="font-mono"
            onChange={(event) => setBottom2(event.target.value.replace(/\D/g, '').slice(0, 2))}
          />
          {formError ? <p className="rounded-2xl bg-danger-soft px-3 py-2 text-sm text-danger">{formError}</p> : null}
          {message ? <p className="rounded-2xl bg-pine-soft px-3 py-2 text-sm text-pine">{message}</p> : null}
          <Button
            className="w-full"
            disabled={settle.isPending}
            onClick={() => {
              if (!/^\d{3}$/.test(top3) || !/^\d{2}$/.test(bottom2) || !batchId) {
                setFormError(copy.settlement.badOutcome);
                setMessage(null);
                return;
              }
              settle.mutate();
            }}
          >
            {settle.isPending ? copy.settlement.submitting : copy.settlement.submit}
          </Button>
        </Card>
      </div>
    </section>
  );
}
