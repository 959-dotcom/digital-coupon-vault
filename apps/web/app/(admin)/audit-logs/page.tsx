'use client';

import { useQuery } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { StatePanel } from '@/components/state-panel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { copy } from '@/lib/copy';

export default function AuditLogsPage() {
  const user = useAuth((state) => state.user);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const logs = useQuery({
    queryKey: ['audit-logs', query, page],
    queryFn: () => api.auditLogs(query, page),
    enabled: user?.role === 'SUPER_ADMIN',
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQuery(draft.trim());
  }

  if (user && user.role !== 'SUPER_ADMIN') {
    return <StatePanel title={copy.audit.forbidden} />;
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">{copy.audit.title}</h1>
      <form className="flex gap-2" onSubmit={onSubmit}>
        <Input
          value={draft}
          placeholder={copy.audit.placeholder}
          onChange={(event) => setDraft(event.target.value)}
          aria-label={copy.audit.search}
        />
        <Button type="submit" className="shrink-0">
          {copy.audit.search}
        </Button>
      </form>
      {logs.isLoading ? <StatePanel title={copy.catalog.loading} /> : null}
      {logs.isError ? <StatePanel title={copy.audit.error} onRetry={() => void logs.refetch()} /> : null}
      {logs.isSuccess && logs.data.rows.length === 0 ? <StatePanel title={copy.audit.empty} /> : null}
      <div className="space-y-3">
        {logs.data?.rows.map((row) => (
          <Card key={row.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold">{actionLabel(row.action)}</p>
              <p className="text-xs text-white/55">
                {new Intl.DateTimeFormat('th-TH', {
                  timeZone: 'Asia/Bangkok',
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(row.createdAt))}
              </p>
            </div>
            <p className="mt-2 break-all font-mono text-[11px] text-white/70">{row.target}</p>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-5 text-white/80">
              {JSON.stringify(row.detail, null, 2)}
            </pre>
          </Card>
        ))}
      </div>
      {logs.isSuccess && logs.data.total > logs.data.pageSize ? (
        <div className="flex items-center justify-between text-sm">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
            {copy.hierarchy.previous}
          </Button>
          <span>
            {copy.hierarchy.page} {page}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page * logs.data.pageSize >= logs.data.total}
            onClick={() => setPage((value) => value + 1)}
          >
            {copy.hierarchy.next}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function actionLabel(action: string): string {
  if (action in copy.audit.actions) {
    return copy.audit.actions[action as keyof typeof copy.audit.actions];
  }
  return action;
}
