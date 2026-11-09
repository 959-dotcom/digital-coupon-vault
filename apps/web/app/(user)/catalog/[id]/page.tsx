'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Decimal } from 'decimal.js';
import { ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { DigitMatrix } from '@/components/digit-matrix';
import { StatePanel } from '@/components/state-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ApiError, api } from '@/lib/api';
import { copy, statusLabel } from '@/lib/copy';
import { formatPoints } from '@/lib/money';
import type { OrderReceipt, SelectionType } from '@/lib/types';
import { cn } from '@/lib/utils';

type Family = 'TOP_3' | 'PERM_3' | 'TOP_2' | 'BOTTOM_2' | 'FLOAT';
type FloatType = 'SINGLE_TOP' | 'SINGLE_BOTTOM' | 'RUNNING_MIX';
type SlipLine = { type: SelectionType; number: string; amount: string };

export default function CatalogDeskPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const category = useQuery({
    queryKey: ['category', params.id],
    queryFn: () => api.category(params.id),
  });
  const [open, setOpen] = useState(true);
  const [family, setFamily] = useState<Family>('TOP_3');
  const [floatType, setFloatType] = useState<FloatType>('RUNNING_MIX');
  const [digits, setDigits] = useState('');
  const [stake, setStake] = useState<string | null>(null);
  const [lines, setLines] = useState<SlipLine[]>([]);
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const pad = category.data?.pad ?? 3;
  const selectionType: SelectionType = family === 'FLOAT' ? floatType : family;
  const length = digitLength(selectionType);
  const activeStake = stake ?? category.data?.stakeAmounts[0] ?? null;
  const batch = category.data?.batches.find((item) => item.isOpen && !item.pastCutoff) ?? null;
  useEffect(() => {
    if (pad < 3 && (family === 'TOP_3' || family === 'PERM_3')) {
      setFamily(pad >= 2 ? 'TOP_2' : 'FLOAT');
      setDigits('');
    }
  }, [pad, family]);

  const total = useMemo(
    () => lines.reduce((sum, line) => sum.plus(line.amount), new Decimal(0)).toFixed(4),
    [lines],
  );

  const order = useMutation({
    mutationFn: async () => {
      if (!category.data || !batch) {
        throw new ApiError(400, copy.desk.noBatch);
      }
      return api.order(
        {
          categoryId: category.data.id,
          batchId: batch.id,
          items: lines.map((line) => ({ type: line.type, number: line.number, amount: line.amount })),
        },
        crypto.randomUUID(),
      );
    },
    onSuccess: async (result) => {
      setReceipt(result);
      setLines([]);
      setDigits('');
      setOpen(false);
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['balance'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (error: Error) => {
      setFormError(error instanceof ApiError ? error.message : copy.errors.generic);
    },
  });

  function chooseFamily(next: Family) {
    setFamily(next);
    setDigits('');
    setFormError(null);
  }

  function addLine() {
    if (!category.data || !activeStake) {
      return;
    }
    if (digits.length !== length || length > category.data.pad) {
      setFormError(copy.selection.badNumber);
      return;
    }
    setFormError(null);
    setLines((current) => {
      const previous = current.find((line) => line.type === selectionType && line.number === digits);
      const amount = previous ? new Decimal(previous.amount).plus(activeStake).toFixed(4) : activeStake;
      const rest = current.filter((line) => !(line.type === selectionType && line.number === digits));
      return [...rest, { type: selectionType, number: digits, amount }];
    });
    setDigits('');
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
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-ink/70">{copy.selection.total}</span>
            <span className="font-mono text-lg font-semibold">{formatPoints(total)}</span>
          </div>
          <Button className="mt-4 w-full" onClick={() => setOpen(true)}>
            {copy.catalog.pick}
          </Button>
        </Card>
      ) : null}

      <Dialog open={open && Boolean(batch)} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{copy.selection.title}</DialogTitle>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <ModeButton label={copy.selection.exact3} active={family === 'TOP_3'} disabled={pad < 3} onClick={() => chooseFamily('TOP_3')} />
            <ModeButton label={copy.selection.perm} active={family === 'PERM_3'} disabled={pad < 3} onClick={() => chooseFamily('PERM_3')} />
            <ModeButton label={copy.selection.top2} active={family === 'TOP_2'} disabled={pad < 2} onClick={() => chooseFamily('TOP_2')} />
            <ModeButton label={copy.selection.bottom2} active={family === 'BOTTOM_2'} disabled={pad < 2} onClick={() => chooseFamily('BOTTOM_2')} />
            <ModeButton label={copy.selection.float} active={family === 'FLOAT'} disabled={pad < 1} onClick={() => chooseFamily('FLOAT')} />
          </div>
          {family === 'FLOAT' ? (
            <div className="mt-2 flex gap-2">
              <ModeButton label={copy.selection.floatTop} active={floatType === 'SINGLE_TOP'} onClick={() => setFloatType('SINGLE_TOP')} />
              <ModeButton label={copy.selection.floatBottom} active={floatType === 'SINGLE_BOTTOM'} onClick={() => setFloatType('SINGLE_BOTTOM')} />
              <ModeButton label={copy.selection.floatMix} active={floatType === 'RUNNING_MIX'} onClick={() => setFloatType('RUNNING_MIX')} />
            </div>
          ) : null}
          <div className="mt-4">
            <DigitMatrix length={length} value={digits} onChange={setDigits} />
          </div>
          <p className="mt-4 text-sm font-medium">{copy.desk.stake}</p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {category.data.stakeAmounts.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setStake(amount)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-2 font-mono text-sm',
                  activeStake === amount ? 'border-pine bg-pine text-white' : 'border-line bg-card text-white',
                )}
              >
                {formatPoints(amount)}
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" className="mt-3 w-full" onClick={addLine}>
            {copy.selection.add}
          </Button>
          <ul className="mt-4 space-y-2">
            {lines.length === 0 ? <li className="text-sm text-ink/60">{copy.selection.empty}</li> : null}
            {lines.map((line) => (
              <li key={`${line.type}:${line.number}`} className="flex justify-between gap-3 text-sm">
                <span>
                  {modeLabel(line.type)} {line.number}
                </span>
                <span className="font-mono">{formatPoints(line.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-ink/70">{copy.selection.total}</span>
            <span className="font-mono text-lg font-semibold">{formatPoints(total)}</span>
          </div>
          {formError ? <p className="mt-3 rounded-2xl bg-danger-soft px-3 py-2 text-sm text-danger">{formError}</p> : null}
          <Button className="mt-4 w-full" disabled={!batch || lines.length === 0 || order.isPending} onClick={() => order.mutate()}>
            {order.isPending ? copy.desk.submitting : copy.desk.submit}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(receipt)} onOpenChange={(next) => !next && setReceipt(null)}>
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
                      {modeLabel(item.type)} {item.number}
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

function ModeButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-2xl border px-3 py-3 text-sm text-white disabled:opacity-40',
        active ? 'border-[#dc2626] bg-[#dc2626]' : 'border-line bg-[#0a0a0a]',
      )}
    >
      {label}
    </button>
  );
}

function digitLength(type: SelectionType): number {
  if (type === 'TOP_3' || type === 'PERM_3') {
    return 3;
  }
  if (type === 'TOP_2' || type === 'BOTTOM_2') {
    return 2;
  }
  return 1;
}

function modeLabel(type: string): string {
  if (type === 'TOP_3') return copy.selection.exact3;
  if (type === 'PERM_3') return copy.selection.perm;
  if (type === 'TOP_2') return copy.selection.top2;
  if (type === 'BOTTOM_2') return copy.selection.bottom2;
  if (type === 'SINGLE_TOP') return copy.selection.floatTop;
  if (type === 'SINGLE_BOTTOM') return copy.selection.floatBottom;
  if (type === 'RUNNING_MIX') return copy.selection.floatMix;
  return type;
}
