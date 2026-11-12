'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StatePanel } from '@/components/state-panel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { copy } from '@/lib/copy';
import type { ReportRow } from '@/lib/types';

const presets = [
  ['today', copy.reports.today],
  ['3', copy.reports.three],
  ['7', copy.reports.seven],
  ['30', copy.reports.thirty],
  ['custom', copy.reports.custom],
] as const;

export default function ReportsPage() {
  const [preset, setPreset] = useState<(typeof presets)[number][0]>('today');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const report = useQuery({
    queryKey: ['reports', preset, from, to],
    queryFn: () => api.report(preset, preset === 'custom' ? from : undefined, preset === 'custom' ? to : undefined),
    enabled: preset !== 'custom' || (from.length === 10 && to.length === 10),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{copy.reports.title}</h1>
      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="outline" className="h-12"><Link href="/network">{copy.nav.network}</Link></Button>
        <Button asChild variant="outline" className="h-12"><Link href="/history">{copy.nav.history}</Link></Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map(([key, label]) => (
          <Button key={key} size="sm" variant={preset === key ? 'default' : 'outline'} onClick={() => setPreset(key)}>
            {label}
          </Button>
        ))}
      </div>
      {preset === 'custom' ? (
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" aria-label={copy.reports.from} value={from} onChange={(event) => setFrom(event.target.value)} />
          <Input type="date" aria-label={copy.reports.to} value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
      ) : null}
      {report.isLoading ? <StatePanel title={copy.states.loading} /> : null}
      {report.isError ? <StatePanel title={copy.errors.generic} /> : null}
      {report.data && report.data.rows.length === 0 ? <StatePanel title={copy.reports.empty} /> : null}
      {report.data && report.data.rows.length > 0 ? (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-white/60">
                <tr>
                  <th className="py-2 pr-3">{copy.reports.username}</th>
                  <th className="py-2 pr-3">{copy.reports.member}</th>
                  <th className="py-2 pr-3">{copy.reports.agent}</th>
                  <th className="py-2 pr-3">{copy.reports.master}</th>
                  <th className="py-2 pr-3">{copy.reports.senior}</th>
                  <th className="py-2 pr-3">{copy.reports.company}</th>
                  <th className="py-2 pr-3">{copy.reports.total}</th>
                  <th className="py-2 pr-3">{copy.reports.sent}</th>
                  <th className="py-2">{copy.reports.received}</th>
                </tr>
              </thead>
              <tbody>
                {report.data.rows.map((row) => (
                  <tr key={row.userId} className="border-t border-white/10">
                    <td className="py-2 pr-3">{row.username}</td>
                    <td className="py-2 pr-3 font-mono">{row.member}</td>
                    <td className="py-2 pr-3 font-mono">{row.agent}</td>
                    <td className="py-2 pr-3 font-mono">{row.master}</td>
                    <td className="py-2 pr-3 font-mono">{row.senior}</td>
                    <td className="py-2 pr-3 font-mono">{row.company}</td>
                    <td className="py-2 pr-3 font-mono">{row.billTotal}</td>
                    <td className="py-2 pr-3 font-mono">{row.sentUpward}</td>
                    <td className="py-2 font-mono">{row.commissionReceived}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">
            {report.data.rows.map((row) => (
              <ReportCard key={row.userId} row={row} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ReportCard({ row }: { row: ReportRow }) {
  const cells = [
    [copy.reports.member, row.member],
    [copy.reports.agent, row.agent],
    [copy.reports.master, row.master],
    [copy.reports.senior, row.senior],
    [copy.reports.company, row.company],
    [copy.reports.total, row.billTotal],
    [copy.reports.sent, row.sentUpward],
    [copy.reports.received, row.commissionReceived],
  ];
  return (
    <Card className="space-y-1 p-4 text-sm">
      <p className="font-semibold">{row.username}</p>
      {cells.map(([label, value]) => (
        <p key={label} className="flex justify-between gap-3">
          <span className="text-white/60">{label}</span>
          <span className="font-mono">{value}</span>
        </p>
      ))}
    </Card>
  );
}
