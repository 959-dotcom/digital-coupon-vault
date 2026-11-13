'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { StatePanel } from '@/components/state-panel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, api, type DepositView } from '@/lib/api';
import { copy } from '@/lib/copy';
import { formatPoints } from '@/lib/money';

const shortcuts = ['100', '300', '500', '1000', '5000'];

export default function DepositPage() {
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: ['deposit-config'], queryFn: () => api.depositConfig() });
  const deposits = useQuery({ queryKey: ['deposits'], queryFn: () => api.deposits() });
  const [amount, setAmount] = useState('100');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const active = useQuery({
    queryKey: ['deposit', activeId],
    queryFn: () => api.deposit(activeId ?? ''),
    enabled: Boolean(activeId),
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' || query.state.data?.status === 'REVIEW' ? 5000 : false),
  });

  const create = useMutation({
    mutationFn: () => api.createDeposit(`${amount}.0000`),
    onSuccess: async (row) => {
      setActiveId(row.id);
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['deposits'] });
    },
    onError: (error: Error) => setFormError(error instanceof ApiError ? error.message : copy.errors.generic),
  });

  const slip = useMutation({
    mutationFn: async (file: File) => {
      const contentBase64 = await fileToBase64(file);
      return api.uploadSlip(activeId ?? '', file.name, contentBase64);
    },
    onSuccess: async () => {
      setNotice(copy.deposit.uploaded);
      await queryClient.invalidateQueries({ queryKey: ['deposit', activeId] });
      await queryClient.invalidateQueries({ queryKey: ['deposits'] });
    },
    onError: (error: Error) => setFormError(error instanceof ApiError ? error.message : copy.errors.generic),
  });

  const current = active.data;
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{copy.deposit.title}</h1>
      {config.data && !config.data.open ? <StatePanel title={copy.deposit.closed} /> : null}
      {config.data?.open ? (
        <Card className="space-y-3 p-4">
          <form
            className="space-y-3"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              setNotice(null);
              if (!/^\d{1,7}$/.test(amount)) {
                setFormError(copy.errors.validation);
                return;
              }
              create.mutate();
            }}
          >
            <Label htmlFor="amount">{copy.deposit.amount}</Label>
            <Input id="amount" inputMode="numeric" className="h-12 text-lg" value={amount} onChange={(event) => setAmount(event.target.value)} />
            <div className="grid grid-cols-3 gap-2">
              {shortcuts.map((value) => (
                <Button key={value} type="button" variant={amount === value ? 'default' : 'outline'} className="h-12" onClick={() => setAmount(value)}>
                  {value}
                </Button>
              ))}
            </div>
            <Button type="submit" className="h-12 w-full" disabled={create.isPending}>{copy.deposit.create}</Button>
          </form>
        </Card>
      ) : null}
      {current ? <DepositCard row={current} /> : null}
      {current && current.qrDataUrl && (current.status === 'PENDING' || current.status === 'REVIEW') ? (
        <Card className="space-y-3 p-4 text-center">
          <img src={current.qrDataUrl} alt={copy.deposit.title} className="mx-auto w-full max-w-xs" />
          <p className="text-sm text-white/70">{copy.deposit.exact}</p>
          <label className="flex min-h-14 cursor-pointer items-center justify-center rounded-2xl bg-[#dc2626] px-4 text-base font-semibold text-white">
            {slip.isPending ? copy.deposit.upload : copy.deposit.slip}
            <input
              className="sr-only"
              type="file"
              accept="image/*,.pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  slip.mutate(file);
                }
              }}
            />
          </label>
        </Card>
      ) : null}
      {notice ? <p className="text-sm text-white/80">{notice}</p> : null}
      {formError ? <p className="text-sm text-[#dc2626]">{formError}</p> : null}
      <div className="space-y-2">
        {deposits.data?.map((row) => (
          <button key={row.id} type="button" className="w-full rounded-2xl border border-white/10 px-4 py-3 text-left" onClick={() => setActiveId(row.id)}>
            <span className="font-mono">{formatPoints(row.amount)}</span>
            <span className="ml-2 text-white/60">{statusText(row.status)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function DepositCard({ row }: { row: DepositView }) {
  return (
    <Card className="space-y-1 p-4">
      <p className="font-mono text-3xl">{formatPoints(row.amount)}</p>
      <p>{statusText(row.status)}</p>
      <p className="text-xs text-white/50">{row.qrRef}</p>
    </Card>
  );
}

function statusText(status: DepositView['status']): string {
  if (status === 'PENDING') return copy.deposit.pending;
  if (status === 'REVIEW') return copy.deposit.review;
  if (status === 'PAID') return copy.deposit.paid;
  if (status === 'REJECTED') return copy.deposit.rejected;
  return copy.deposit.expired;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? '');
      const comma = value.indexOf(',');
      resolve(comma >= 0 ? value.slice(comma + 1) : value);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
