'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Decimal } from 'decimal.js';
import { Minus, Plus, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { StatePanel } from '@/components/state-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ApiError, api } from '@/lib/api';
import { copy, statusLabel } from '@/lib/copy';
import { formatPoints } from '@/lib/money';
import type { OrderReceipt } from '@/lib/types';
import { cn } from '@/lib/utils';

type Line = { quantity: string };

export default function CatalogDeskPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const category = useQuery({
    queryKey: ['category', params.id],
    queryFn: () => api.category(params.id),
  });
  const [stake, setStake] = useState<string | null>(null);
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const activeStake = stake ?? category.data?.stakeAmounts[0] ?? null;
  const batch = category.data?.batches.find((item) => item.isOpen && !item.pastCutoff) ?? null;
  const numbers = useMemo(() => {
    if (!category.data) {
      return [];
    }
    const values: string[] = [];
    for (let index = category.data.gridMin; index <= category.data.gridMax; index += 1) {
      values.push(String(index).padStart(category.data.pad, '0'));
    }
    return values;
  }, [category.data]);

  const total = useMemo(() => {
    if (!activeStake) {
      return '0.0000';
    }
    return Object.values(lines)
      .reduce((sum, line) => sum.plus(new Decimal(line.quantity).mul(activeStake)), new Decimal(0))
      .toFixed(4);
  }, [lines, activeStake]);

  const order = useMutation({
    mutationFn: async () => {
      if (!category.data || !batch || !activeStake) {
        throw new ApiError(400, copy.desk.noBatch);
      }
      const items = Object.entries(lines).map(([sku, line]) => ({
        type: category.data.pad >= 3 ? ('TOP_3' as const) : ('TOP_2' as const),
        number: sku,
        amount: new Decimal(line.quantity).mul(activeStake).toFixed(4),
      }));
      return api.order(
        { categoryId: category.data.id, batchId: batch.id, items },
        crypto.randomUUID(),
      );
    },
    onSuccess: async (result) => {
      setReceipt(result);
      setLines({});
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['balance'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (error: Error) => {
      setFormError(error instanceof ApiError ? error.message : copy.errors.generic);
    },
  });

  function toggle(sku: string) {
    setLines((current) => {
      if (current[sku]) {
        const next = { ...current };
        delete next[sku];
        return next;
      }
      return { ...current, [sku]: { quantity: '1' } };
    });
  }

  function changeQuantity(sku: string, direction: 1 | -1) {
    setLines((current) => {
      const line = current[sku];
      if (!line) {
        return current;
      }
      const nextQuantity = new Decimal(line.quantity).plus(direction);
      if (nextQuantity.lte(0)) {
        const next = { ...current };
        delete next[sku];
        return next;
      }
      if (nextQuantity.gt(9999)) {
        return current;
      }
      return { ...current, [sku]: { quantity: nextQuantity.toFixed(0) } };
    });
  }

  if (category.isLoading) {
    return <StatePanel title={copy.catalog.loading} />;
  }
  if (category.isError) {
    const message = category.error instanceof ApiError ? category.error.message : copy.desk.loadError;
    return <StatePanel title={message} onRetry={() => void category.refetch()} />;
  }
  if (!category.data) {
    return <StatePanel title={copy.desk.noCategory} />;
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-brass">{category.data.code}</p>
        <h1 className="text-2xl font-semibold">{category.data.name}</h1>
        <p className="mt-1 text-sm leading-6 text-ink/70">{category.data.description}</p>
      </div>

      {!batch ? <StatePanel title={copy.desk.noBatch} /> : null}

      {batch ? (
        <Card className="p-4">
          <p className="text-xs text-ink/55">
            {copy.desk.batch} {batch.label} · {copy.desk.cutoff}{' '}
            {new Intl.DateTimeFormat('th-TH', {
              timeZone: 'Asia/Bangkok',
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(batch.cutoffAt))}
          </p>
          <p className="mt-3 text-sm font-medium">{copy.desk.stake}</p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {category.data.stakeAmounts.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setStake(amount)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-2 font-mono text-sm',
                  (stake ?? category.data?.stakeAmounts[0]) === amount
                    ? 'border-pine bg-pine text-paper'
                    : 'border-line bg-card',
                )}
              >
                {formatPoints(amount)}
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
            {numbers.map((sku) => {
              const selected = Boolean(lines[sku]);
              return (
                <button
                  key={sku}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggle(sku)}
                  className={cn(
                    'h-11 rounded-xl border font-mono text-sm',
                    selected ? 'border-brass bg-brass text-paper' : 'border-line bg-paper',
                  )}
                >
                  {sku}
                </button>
              );
            })}
          </div>
        </Card>
      ) : null}

      <Card className="p-4">
        <h2 className="text-sm font-semibold">{copy.desk.selected}</h2>
        {Object.keys(lines).length === 0 ? <p className="mt-3 text-sm text-ink/60">{copy.desk.emptySelection}</p> : null}
        <ul className="mt-3 space-y-2">
          {Object.entries(lines)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([sku, line]) => (
              <li key={sku} className="flex items-center justify-between gap-2 rounded-2xl bg-paper px-3 py-2">
                <div>
                  <p className="text-sm font-medium">
                    {copy.desk.number} {sku}
                  </p>
                  <p className="font-mono text-xs text-ink/55">{activeStake ? formatPoints(activeStake) : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" size="icon" variant="outline" aria-label={copy.desk.remove} onClick={() => changeQuantity(sku, -1)}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center font-mono text-sm">{line.quantity}</span>
                  <Button type="button" size="icon" variant="outline" aria-label={copy.desk.quantity} onClick={() => changeQuantity(sku, 1)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
        </ul>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-ink/70">{copy.desk.total}</span>
          <span className="font-mono text-lg font-semibold">{formatPoints(total)}</span>
        </div>
        {formError ? <p className="mt-3 rounded-2xl bg-danger-soft px-3 py-2 text-sm text-danger">{formError}</p> : null}
        <Button
          className="mt-4 w-full"
          disabled={!batch || Object.keys(lines).length === 0 || order.isPending}
          onClick={() => order.mutate()}
        >
          {order.isPending ? copy.desk.submitting : copy.desk.submit}
        </Button>
      </Card>

      <Dialog open={Boolean(receipt)} onOpenChange={(open) => !open && setReceipt(null)}>
        <DialogContent>
          {receipt ? (
            <div>
              <DialogTitle>{copy.receipt.title}</DialogTitle>
              <div className="mt-4 flex gap-3 rounded-2xl bg-pine-soft p-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-pine" />
                <div>
                  <p className="text-sm font-semibold text-pine">{copy.receipt.seal}</p>
                  <p className="mt-1 break-all font-mono text-[11px] leading-5 text-ink/80">{receipt.txHash}</p>
                  <p className="mt-1 text-xs text-pine">{receipt.vaultValid ? copy.receipt.verified : copy.receipt.mismatch}</p>
                </div>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink/60">{copy.receipt.status}</dt>
                  <dd>{statusLabel(receipt.status)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink/60">{copy.receipt.total}</dt>
                  <dd className="font-mono">{formatPoints(receipt.totalAmount)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink/60">{copy.receipt.when}</dt>
                  <dd>
                    {new Intl.DateTimeFormat('th-TH', {
                      timeZone: 'Asia/Bangkok',
                      dateStyle: 'medium',
                      timeStyle: 'medium',
                    }).format(new Date(receipt.createdAt))}
                  </dd>
                </div>
              </dl>
              <ul className="mt-4 space-y-1 text-sm">
                {receipt.items.map((item) => (
                  <li key={`${item.type}:${item.number}`} className="flex justify-between gap-3">
                    <span>
                      {item.type} {item.number}
                    </span>
                    <span className="font-mono">{formatPoints(item.amount)}</span>
                  </li>
                ))}
              </ul>
              <Badge className="mt-4 bg-pine-soft text-pine">{receipt.categoryCode}</Badge>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
