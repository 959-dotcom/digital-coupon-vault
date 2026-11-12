'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatePanel } from '@/components/state-panel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ApiError, api } from '@/lib/api';
import { copy, statusLabel } from '@/lib/copy';
import { useAuth } from '@/lib/auth-store';
import { formatPoints } from '@/lib/money';

export default function WithdrawalQueuePage() {
  const user = useAuth((state) => state.user);
  const queryClient = useQueryClient();
  const queue = useQuery({
    queryKey: ['admin-withdrawals'],
    queryFn: () => api.adminWithdrawals(),
    enabled: user?.role === 'SUPER_ADMIN',
  });

  const decide = useMutation({
    mutationFn: (input: { id: string; decision: 'approve' | 'reject' }) =>
      input.decision === 'approve' ? api.approveWithdrawal(input.id) : api.rejectWithdrawal(input.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] });
    },
  });

  if (user && user.role !== 'SUPER_ADMIN') {
    return <StatePanel title={copy.queue.forbidden} />;
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">{copy.queue.title}</h1>
      <p className="text-sm text-white/70">{copy.queue.notTransferred}</p>
      {queue.isLoading ? <StatePanel title={copy.catalog.loading} /> : null}
      {queue.isError ? <StatePanel title={copy.queue.error} onRetry={() => void queue.refetch()} /> : null}
      {queue.isSuccess && queue.data.length === 0 ? <StatePanel title={copy.queue.empty} /> : null}
      <div className="space-y-3">
        {queue.data?.map((row) => (
          <Card key={row.id} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{row.member}</p>
                <p className="text-xs text-white/55">{row.email}</p>
                <p className="mt-2 text-xs text-white/55">{row.destination}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-semibold">{formatPoints(row.amount)}</p>
                <p className="mt-1 text-xs text-white/55">{statusLabel(row.status)}</p>
              </div>
            </div>
            {decide.isError && decide.variables?.id === row.id ? (
              <p className="rounded-2xl bg-danger-soft px-3 py-2 text-sm text-danger">
                {decide.error instanceof ApiError ? decide.error.message : copy.errors.generic}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: row.id, decision: 'approve' })}
              >
                {copy.queue.approve}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: row.id, decision: 'reject' })}
              >
                {copy.queue.reject}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
