'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Decimal } from 'decimal.js';
import { useMemo, useState } from 'react';
import { StatePanel } from '@/components/state-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ApiError, api } from '@/lib/api';
import { copy, statusLabel } from '@/lib/copy';
import { formatPoints } from '@/lib/money';
import type { CategoryGroup, CategoryView, OrderReceipt, SelectionType } from '@/lib/types';
import { cn } from '@/lib/utils';

const GROUPS: CategoryGroup[] = ['NATIONAL', 'REGIONAL', 'FLASH', 'STOCK'];

const GROUP_LABEL: Record<CategoryGroup, string> = {
  NATIONAL: copy.catalog.national,
  REGIONAL: copy.catalog.regional,
  FLASH: copy.catalog.flash,
  STOCK: copy.catalog.stock,
};

type SlipLine = { type: SelectionType; number: string; amount: string };

export default function CatalogPage() {
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.categories(),
    refetchInterval: 15_000,
  });
  const [selected, setSelected] = useState<CategoryView | null>(null);

  return (
    <section>
      <h1 className="text-2xl font-semibold">{copy.catalog.title}</h1>
      <div className="mt-4 space-y-6">
        {categories.isLoading ? <StatePanel title={copy.catalog.loading} /> : null}
        {categories.isError ? <StatePanel title={copy.catalog.error} onRetry={() => void categories.refetch()} /> : null}
        {categories.isSuccess && categories.data.length === 0 ? <StatePanel title={copy.catalog.empty} /> : null}
        {GROUPS.map((group) => {
          const rows = categories.data?.filter((category) => category.group === group) ?? [];
          if (rows.length === 0) {
            return null;
          }
          return (
            <div key={group}>
              <h2 className="text-sm font-semibold text-brass">{GROUP_LABEL[group]}</h2>
              <div className="mt-2 space-y-3">
                {rows.map((category) => {
                  const open = category.batches.some((batch) => batch.isOpen && !batch.pastCutoff && !batch.settled);
                  return (
                    <button key={category.id} type="button" className="block w-full text-left" onClick={() => setSelected(category)}>
                      <Card className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-brass">{category.code}</p>
                            <h3 className="mt-1 text-lg font-semibold">{category.name}</h3>
                            <p className="mt-1 text-sm leading-6 text-ink/70">{category.description}</p>
                            <p className="mt-2 font-mono text-xs text-ink/60">
                              {copy.catalog.countdown} {formatCountdown(category.countdownSeconds)}
                            </p>
                          </div>
                          <Badge className={open ? 'bg-pine-soft text-pine' : 'bg-danger-soft text-danger'}>
                            {open ? copy.catalog.pick : copy.catalog.closed}
                          </Badge>
                        </div>
                      </Card>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <SelectionModal key={selected?.id ?? 'closed'} category={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

function SelectionModal({ category, onClose }: { category: CategoryView | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [family, setFamily] = useState<'TOP_3' | 'PERM_3' | 'TOP_2' | 'BOTTOM_2' | 'FLOAT'>('TOP_3');
  const [floatType, setFloatType] = useState<'SINGLE_TOP' | 'SINGLE_BOTTOM' | 'RUNNING_MIX'>('RUNNING_MIX');
  const [number, setNumber] = useState('');
  const [stake, setStake] = useState<string | null>(null);
  const [lines, setLines] = useState<SlipLine[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);

  const selectionType: SelectionType = family === 'FLOAT' ? floatType : family;
  const digits = selectionType === 'TOP_3' || selectionType === 'PERM_3' ? 3 : selectionType === 'TOP_2' || selectionType === 'BOTTOM_2' ? 2 : 1;
  const activeStake = stake ?? category?.stakeAmounts[0] ?? null;
  const batch = category?.batches.find((item) => item.isOpen && !item.pastCutoff && !item.settled) ?? null;
  const total = useMemo(
    () => lines.reduce((sum, line) => sum.plus(line.amount), new Decimal(0)).toFixed(4),
    [lines],
  );

  const order = useMutation({
    mutationFn: async () => {
      if (!category || !batch) {
        throw new ApiError(400, copy.desk.noBatch);
      }
      return api.order({ categoryId: category.id, batchId: batch.id, items: lines }, crypto.randomUUID());
    },
    onSuccess: async (result) => {
      setReceipt(result);
      setLines([]);
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['balance'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (error: Error) => {
      setFormError(error instanceof ApiError ? error.message : copy.errors.generic);
    },
  });

  function addLine() {
    if (!category || !activeStake) {
      return;
    }
    if (!new RegExp(`^\\d{${digits}}$`).test(number) || digits > category.pad) {
      setFormError(copy.selection.badNumber);
      return;
    }
    setFormError(null);
    setLines((current) => {
      const next = current.filter((line) => !(line.type === selectionType && line.number === number));
      const previous = current.find((line) => line.type === selectionType && line.number === number);
      const amount = previous ? new Decimal(previous.amount).plus(activeStake).toFixed(4) : activeStake;
      return [...next, { type: selectionType, number, amount }];
    });
    setNumber('');
  }

  return (
    <Dialog open={Boolean(category)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {category ? (
          <div>
            <DialogTitle>{category.name}</DialogTitle>
            <p className="mt-1 text-sm text-ink/65">{copy.selection.title}</p>
            {!batch ? <p className="mt-3 text-sm text-danger">{copy.desk.noBatch}</p> : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <TypeButton active={family === 'TOP_3'} label={copy.selection.exact3} onClick={() => setFamily('TOP_3')} />
              <TypeButton active={family === 'PERM_3'} label={copy.selection.perm} onClick={() => setFamily('PERM_3')} />
              <TypeButton active={family === 'TOP_2'} label={copy.selection.top2} onClick={() => setFamily('TOP_2')} />
              <TypeButton active={family === 'BOTTOM_2'} label={copy.selection.bottom2} onClick={() => setFamily('BOTTOM_2')} />
              <TypeButton active={family === 'FLOAT'} label={copy.selection.float} onClick={() => setFamily('FLOAT')} />
            </div>
            {family === 'FLOAT' ? (
              <div className="mt-2 flex gap-2">
                <TypeButton active={floatType === 'SINGLE_TOP'} label={copy.selection.floatTop} onClick={() => setFloatType('SINGLE_TOP')} />
                <TypeButton active={floatType === 'SINGLE_BOTTOM'} label={copy.selection.floatBottom} onClick={() => setFloatType('SINGLE_BOTTOM')} />
                <TypeButton active={floatType === 'RUNNING_MIX'} label={copy.selection.floatMix} onClick={() => setFloatType('RUNNING_MIX')} />
              </div>
            ) : null}
            <label className="mt-4 block text-sm font-medium" htmlFor="selection-number">
              {copy.selection.number}
            </label>
            <Input
              id="selection-number"
              inputMode="numeric"
              maxLength={digits}
              value={number}
              onChange={(event) => setNumber(event.target.value.replace(/\D/g, '').slice(0, digits))}
              className="mt-1 font-mono"
            />
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {category.stakeAmounts.map((amount) => (
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
            <Button type="button" className="mt-3 w-full" variant="outline" onClick={addLine}>
              {copy.selection.add}
            </Button>
            <ul className="mt-4 space-y-2">
              {lines.length === 0 ? <li className="text-sm text-ink/60">{copy.selection.empty}</li> : null}
              {lines.map((line) => (
                <li key={`${line.type}:${line.number}`} className="flex justify-between gap-3 text-sm">
                  <span>
                    {line.type} {line.number}
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
            {receipt ? (
              <div className="mt-4 rounded-2xl bg-pine-soft p-3 text-sm">
                <p className="font-semibold text-pine">{copy.receipt.title}</p>
                <p className="mt-1 break-all font-mono text-[11px]">{receipt.txHash}</p>
                <p className="mt-1">{statusLabel(receipt.status)} · {formatPoints(receipt.totalAmount)}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TypeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('rounded-2xl border px-3 py-2 text-sm text-white', active ? 'border-pine bg-pine' : 'border-line bg-card')}
    >
      {label}
    </button>
  );
}

function formatCountdown(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return `${hours} ชม. ${minutes} นาที ${rest} วินาที`;
}
