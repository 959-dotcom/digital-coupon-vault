'use client';

import { useQuery } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { StatePanel } from '@/components/state-panel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { copy } from '@/lib/copy';
import { formatPoints } from '@/lib/money';

export default function CommissionReportPage() {
  const user = useAuth((state) => state.user);
  const [from, setFrom] = useState(() => shiftBangkokDate(-6));
  const [to, setTo] = useState(() => shiftBangkokDate(0));
  const [range, setRange] = useState({ from: shiftBangkokDate(-6), to: shiftBangkokDate(0) });
  const allowed = user?.role === 'SUPER_ADMIN' || user?.role === 'MASTER_PARTNER' || user?.role === 'PARTNER';
  const report = useQuery({
    queryKey: ['commission-report', range.from, range.to],
    queryFn: () => api.commissionReport(range.from, range.to),
    enabled: allowed,
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setRange({ from, to });
  }

  if (user && user.role === 'MEMBER') {
    return <StatePanel title={copy.errors.forbidden} />;
  }

  const empty = report.isSuccess && report.data.byDay.length === 0 && report.data.byBatch.length === 0;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">{copy.report.title}</h1>
      <Card className="p-4">
        <form className="grid grid-cols-1 gap-3" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="report-from">{copy.report.from}</Label>
            <Input id="report-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="report-to">{copy.report.to}</Label>
            <Input id="report-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} required />
          </div>
          <Button type="submit">{copy.report.apply}</Button>
        </form>
      </Card>
      {report.isLoading ? <StatePanel title={copy.catalog.loading} /> : null}
      {report.isError ? <StatePanel title={copy.report.error} onRetry={() => void report.refetch()} /> : null}
      {empty ? <StatePanel title={copy.report.empty} /> : null}
      {report.isSuccess && !empty ? (
        <>
          <Card className="p-4">
            <p className="text-xs text-white/55">{copy.report.total}</p>
            <p className="font-mono text-lg">{formatPoints(report.data.total)}</p>
          </Card>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">{copy.report.byDay}</h2>
            {report.data.byDay.map((row) => (
              <Card key={row.date} className="flex items-center justify-between p-4">
                <span className="text-sm">{row.date}</span>
                <span className="font-mono text-sm">{formatPoints(row.amount)}</span>
              </Card>
            ))}
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">{copy.report.byBatch}</h2>
            {report.data.byBatch.map((row) => (
              <Card key={row.batchId} className="p-4">
                <p className="text-sm font-semibold">{row.categoryName}</p>
                <p className="mt-1 text-xs text-white/55">{row.label}</p>
                <p className="mt-2 font-mono text-sm">{formatPoints(row.amount)}</p>
              </Card>
            ))}
          </section>
        </>
      ) : null}
    </section>
  );
}

function shiftBangkokDate(days: number): string {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [year, month, day] = today.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
