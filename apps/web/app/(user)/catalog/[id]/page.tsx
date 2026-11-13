'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { DigitMatrix } from '@/components/digit-matrix';
import { StakePad } from '@/components/stake-pad';
import { StatePanel } from '@/components/state-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ApiError, api } from '@/lib/api';
import { copy, statusLabel } from '@/lib/copy';
import { formatPoints, livePointsTotal } from '@/lib/money';
import { addPermutations, addStake } from '@/lib/slip-lines';
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
  const [family, setFamily] = useState<Family>('TOP_3');
  const [floatType, setFloatType] = useState<FloatType>('RUNNING_MIX');
  const [digits, setDigits] = useState('');
  const [lines, setLines] = useState<SlipLine[]>([]);
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const pad = category.data?.pad ?? 3;
  const selectionType: SelectionType = family === 'FLOAT' ? floatType : family;
  const length = digitLength(selectionType);
  const batch = category.data?.batches.find((item) => item.isOpen && !item.pastCutoff) ?? null;
  useEffect(() => {
    if (pad < 3 && (family === 'TOP_3' || family === 'PERM_3')) {
      setFamily(pad >= 2 ? 'TOP_2' : 'FLOAT');
      setDigits('');
    }
  }, [pad, family]);

  const liveTotal = useMemo(() => livePointsTotal(lines, null), [lines]);

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

  function readyNumber(): boolean {
    if (!category.data || digits.length !== length || length > category.data.pad) {
      setFormError(copy.selection.badNumber);
      return false;
    }
    setFormError(null);
    return true;
  }

  function applyAmount(amount: string) {
    if (!readyNumber()) {
      return;
    }
    setLines((current) => addStake(current, selectionType, digits, amount));
  }

  function applyReverse(amount: string) {
    if (!readyNumber()) {
      return;
    }
    if (digits.length < 2) {
      setFormError(copy.selection.reverseDigits);
      return;
    }
    setLines((current) => addPermutations(current, selectionType, digits, amount));
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
        <Card className="space-y-4 p-4">
          <p className="text-xs text-ink/55">
            {copy.desk.batch} {batch.label} · {copy.desk.cutoff}{' '}
            {new Intl.DateTimeFormat('th-TH', {
              timeZone: 'Asia/Bangkok',
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(batch.cutoffAt))}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <ModeButton label={copy.selection.exact3} active={family === 'TOP_3'} disabled={pad < 3} onClick={() => chooseFamily('TOP_3')} />
            <ModeButton label={copy.selection.perm} active={family === 'PERM_3'} disabled={pad < 3} onClick={() => chooseFamily('PERM_3')} />
            <ModeButton label={copy.selection.top2} active={family === 'TOP_2'} disabled={pad < 2} onClick={() => chooseFamily('TOP_2')} />
            <ModeButton label={copy.selection.bottom2} active={family === 'BOTTOM_2'} disabled={pad < 2} onClick={() => chooseFamily('BOTTOM_2')} />
            <ModeButton label={copy.selection.float} active={family === 'FLOAT'} disabled={pad < 1} onClick={() => chooseFamily('FLOAT')} />
          </div>
          {family === 'FLOAT' ? (
            <div className="flex gap-2">
              <ModeButton label={copy.selection.floatTop} active={floatType === 'SINGLE_TOP'} onClick={() => setFloatType('SINGLE_TOP')} />
              <ModeButton label={copy.selection.floatBottom} active={floatType === 'SINGLE_BOTTOM'} onClick={() => setFloatType('SINGLE_BOTTOM')} />
              <ModeButton label={copy.selection.floatMix} active={floatType === 'RUNNING_MIX'} onClick={() => setFloatType('RUNNING_MIX')} />
            </div>
          ) : null}
          <DigitMatrix length={length} value={digits} onChange={setDigits} />
          <StakePad disabled={!batch} onAmount={applyAmount} onReverse={applyReverse} />
          <ul className="space-y-2">
            {lines.length === 0 ? <li className="text-sm text-ink/60">{copy.selection.empty}</li> : null}
            {lines.map((line) => (
              <li key={`${line.type}:${line.number}`} className="flex min-h-12 items-center justify-between gap-3 text-base">
                <span>
                  {modeLabel(line.type)} {line.number}
                </span>
                <span className="font-mono">{formatPoints(line.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink/70">{copy.selection.liveTotal}</span>
            <span className="font-mono text-lg font-semibold">{formatPoints(liveTotal)}</span>
          </div>
          {formError ? <p className="rounded-2xl bg-danger-soft px-3 py-2 text-sm text-danger">{formError}</p> : null}
          <Button className="h-14 w-full text-base" disabled={!batch || lines.length === 0 || order.isPending} onClick={() => order.mutate()}>
            {order.isPending ? copy.desk.submitting : copy.desk.submit}
          </Button>
        </Card>
      ) : null}

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
        'min-h-12 rounded-2xl border px-3 py-3 text-base text-white disabled:opacity-40',
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
