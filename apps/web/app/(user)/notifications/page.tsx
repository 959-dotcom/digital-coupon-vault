'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatePanel } from '@/components/state-panel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { copy } from '@/lib/copy';

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const inbox = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.notifications(),
    refetchInterval: 15_000,
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };
  const mark = useMutation({
    mutationFn: (id: string) => api.readNotification(id),
    onSuccess: refresh,
  });
  const markAll = useMutation({
    mutationFn: () => api.readAllNotifications(),
    onSuccess: refresh,
  });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-white">{copy.inbox.title}</h1>
        <Button type="button" variant="outline" size="sm" disabled={markAll.isPending || inbox.data?.unread === 0} onClick={() => markAll.mutate()}>
          {copy.inbox.markAll}
        </Button>
      </div>
      {inbox.isLoading ? <StatePanel title={copy.catalog.loading} /> : null}
      {inbox.isError ? <StatePanel title={copy.inbox.error} onRetry={() => void inbox.refetch()} /> : null}
      {inbox.isSuccess && inbox.data.rows.length === 0 ? <StatePanel title={copy.inbox.empty} /> : null}
      <div className="space-y-3">
        {inbox.data?.rows.map((row) => (
          <Card key={row.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold">{row.title}</p>
              <span className={row.readAt ? 'text-[11px] text-white/45' : 'text-[11px] font-semibold text-[#dc2626]'}>
                {row.readAt ? copy.inbox.read : copy.inbox.unread}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-white/80">{row.body}</p>
            <p className="mt-2 text-xs text-white/45">
              {new Intl.DateTimeFormat('th-TH', {
                timeZone: 'Asia/Bangkok',
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(row.createdAt))}
            </p>
            {row.readAt ? null : (
              <Button className="mt-3" type="button" variant="outline" size="sm" disabled={mark.isPending} onClick={() => mark.mutate(row.id)}>
                {copy.inbox.mark}
              </Button>
            )}
          </Card>
        ))}
      </div>
    </section>
  );
}
