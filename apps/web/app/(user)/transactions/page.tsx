'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Decimal } from 'decimal.js';
import { FormEvent, useState } from 'react';
import { StatePanel } from '@/components/state-panel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, api } from '@/lib/api';
import { copy, memoLabel, statusLabel } from '@/lib/copy';
import { formatPoints } from '@/lib/money';

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const ledger = useQuery({ queryKey: ['point-ledger'], queryFn: () => api.pointLedger() });
  const requests = useQuery({ queryKey: ['withdrawals'], queryFn: () => api.withdrawals() });
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const withdraw = useMutation({
    mutationFn: () => {
      const normalized = normalizeAmount(amount);
      return api.withdraw({ amount: normalized, destination: destination.trim() });
    },
    onSuccess: async () => {
      setNotice(copy.flow.done);
      setFormError(null);
      setAmount('');
      setDestination('');
      await queryClient.invalidateQueries({ queryKey: ['point-ledger'] });
      await queryClient.invalidateQueries({ queryKey: ['withdrawals'] });
      await queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
    onError: (error: Error) => {
      setNotice(null);
      setFormError(error instanceof ApiError ? error.message : copy.errors.generic);
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (destination.trim().length === 0) {
      setFormError(copy.flow.destinationHint);
      setNotice(null);
      return;
    }
    try {
      normalizeAmount(amount);
    } catch {
      setFormError(copy.flow.badAmount);
      setNotice(null);
      return;
    }
    withdraw.mutate();
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">{copy.flow.title}</h1>
      <Card className="p-4">
        <h2 className="text-lg font-semibold">{copy.flow.withdraw}</h2>
        <form className="mt-3 space-y-3" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="withdraw-amount">{copy.flow.amount}</Label>
            <Input
              id="withdraw-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="font-mono"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="withdraw-destination">{copy.flow.destination}</Label>
            <Input
              id="withdraw-destination"
              value={destination}
              placeholder={copy.flow.destinationHint}
              maxLength={80}
              onChange={(event) => setDestination(event.target.value)}
              required
            />
          </div>
          {formError ? <p className="rounded-2xl bg-danger-soft px-3 py-2 text-sm text-danger">{formError}</p> : null}
          {notice ? <p className="rounded-2xl bg-pine-soft px-3 py-2 text-sm text-pine">{notice}</p> : null}
          <Button className="w-full" type="submit" disabled={withdraw.isPending}>
            {withdraw.isPending ? copy.flow.submitting : copy.flow.submit}
          </Button>
        </form>
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-semibold">{copy.flow.requests}</h2>
        {requests.isSuccess && requests.data.length === 0 ? (
          <p className="mt-2 text-sm text-white/60">{copy.flow.requestsEmpty}</p>
        ) : null}
        <ul className="mt-3 space-y-2">
          {requests.data?.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 text-sm">
              <span>
                {statusLabel(row.status)} · {row.destination}
              </span>
              <span className="font-mono">{formatPoints(row.amount)}</span>
            </li>
          ))}
        </ul>
      </Card>

      {ledger.isLoading ? <StatePanel title={copy.catalog.loading} /> : null}
      {ledger.isError ? <StatePanel title={copy.flow.error} onRetry={() => void ledger.refetch()} /> : null}
      {ledger.isSuccess && ledger.data.length === 0 ? <StatePanel title={copy.flow.empty} /> : null}
      <div className="space-y-3">
        {ledger.data?.map((line) => (
          <Card key={line.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{memoLabel(line.memo)}</p>
                <p className="mt-1 text-xs text-white/55">
                  {new Intl.DateTimeFormat('th-TH', {
                    timeZone: 'Asia/Bangkok',
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(line.createdAt))}
                </p>
              </div>
              <div className="text-right font-mono text-xs">
                <p>
                  {copy.flow.debit} {formatPoints(line.debit)}
                </p>
                <p className="mt-1">
                  {copy.flow.credit} {formatPoints(line.credit)}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-white/60">{copy.flow.running}</p>
            <p className="font-mono text-sm font-semibold">{formatPoints(line.running)}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

function normalizeAmount(input: string): string {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,8})?$/.test(trimmed)) {
    throw new Error('INVALID_AMOUNT');
  }
  const parsed = new Decimal(trimmed);
  if (parsed.lte(0)) {
    throw new Error('INVALID_AMOUNT');
  }
  return parsed.toFixed(4);
}
