'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { StatePanel } from '@/components/state-panel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Decimal } from 'decimal.js';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { copy } from '@/lib/copy';

export default function HoldPage() {
  const user = useAuth((state) => state.user);
  const queryClient = useQueryClient();
  const bar = useQuery({ queryKey: ['hold-bar'], queryFn: () => api.holdBar() });
  const [hold, setHold] = useState('0.00');
  const [base, setBase] = useState('5.00');
  const [lock, setLock] = useState<'ADMIN_LOCK' | 'SELF_MANAGE'>('ADMIN_LOCK');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!bar.data) {
      return;
    }
    setHold(bar.data.ownHoldPercent);
    setBase(bar.data.adminBasePercent);
    setLock(bar.data.percentLockMode);
  }, [bar.data]);

  const save = useMutation({
    mutationFn: () => api.updateHold(user?.userId ?? '', hold),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['hold-bar'] });
    },
    onError: (error: Error) => setFormError(error instanceof ApiError ? error.message : copy.errors.generic),
  });

  const saveSettings = useMutation({
    mutationFn: () => api.updateSystemSettings({ adminBasePercent: base, percentLockMode: lock }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['hold-bar'] });
    },
    onError: (error: Error) => setFormError(error instanceof ApiError ? error.message : copy.errors.generic),
  });

  if (bar.isLoading) {
    return <StatePanel title={copy.states.loading} />;
  }
  if (bar.isError || !bar.data) {
    return <StatePanel title={copy.errors.generic} />;
  }

  const upline = bar.data.uplineHolds.reduce((sum, row) => sum.plus(row.holdPercent), new Decimal(0));
  const own = hold.trim() === '' ? new Decimal(0) : new Decimal(hold);
  const admin = new Decimal(bar.data.adminBasePercent);
  const quota = Decimal.max(new Decimal(100).minus(admin).minus(upline).minus(own), 0);
  const segments = [
    { label: copy.hold.admin, value: admin.toNumber(), text: admin.toFixed(2), className: 'bg-[#dc2626]' },
    { label: copy.hold.upline, value: upline.toNumber(), text: upline.toFixed(2), className: 'bg-brass' },
    { label: copy.hold.own, value: own.toNumber(), text: own.toFixed(2), className: 'bg-white' },
    { label: copy.hold.quota, value: quota.toNumber(), text: quota.toFixed(2), className: 'bg-white/20' },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{copy.hold.title}</h1>
      <Card className="space-y-3 p-4">
        <div className="flex h-4 overflow-hidden rounded-full bg-black">
          {segments.map((segment) => (
            <div key={segment.label} className={segment.className} style={{ width: `${segment.value}%` }} title={segment.label} />
          ))}
        </div>
        <ul className="space-y-1 text-sm text-white/80">
          {segments.map((segment) => (
            <li key={segment.label}>{segment.label}: {segment.text}%</li>
          ))}
        </ul>
        <p className="text-sm text-white/60">{copy.hold.range}</p>
        <p className="text-sm text-white/60">{bar.data.percentLockMode === 'ADMIN_LOCK' ? copy.hold.lock : copy.hold.self}</p>
        <p className="text-sm">{copy.hold.max}: {bar.data.maxOwnHold}%</p>
        <form
          className="space-y-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            setFormError(null);
            save.mutate();
          }}
        >
          <Label htmlFor="own">{copy.hold.own}</Label>
          <Input id="own" value={hold} onChange={(event) => setHold(event.target.value)} disabled={!bar.data.canEditOwn} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!bar.data.canEditOwn}>{copy.hold.save}</Button>
            <Button type="button" size="sm" variant="outline" disabled={!bar.data.canEditOwn} onClick={() => setHold('0.00')}>
              {copy.hold.zero}
            </Button>
          </div>
        </form>
        {formError ? <p className="text-sm text-[#dc2626]">{formError}</p> : null}
      </Card>
      {user?.role === 'SUPER_ADMIN' ? (
        <Card className="space-y-3 p-4">
          <Label htmlFor="base">{copy.hold.admin}</Label>
          <Input id="base" value={base} onChange={(event) => setBase(event.target.value)} />
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={lock === 'ADMIN_LOCK' ? 'default' : 'outline'} onClick={() => setLock('ADMIN_LOCK')}>
              {copy.hold.lock}
            </Button>
            <Button type="button" size="sm" variant={lock === 'SELF_MANAGE' ? 'default' : 'outline'} onClick={() => setLock('SELF_MANAGE')}>
              {copy.hold.self}
            </Button>
          </div>
          <Button size="sm" onClick={() => saveSettings.mutate()}>{copy.hold.save}</Button>
        </Card>
      ) : null}
    </div>
  );
}
