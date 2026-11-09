'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Decimal } from 'decimal.js';
import { useEffect, useMemo, useState } from 'react';
import { StatePanel } from '@/components/state-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { copy, memoLabel, modeLabel, statusLabel } from '@/lib/copy';
import { formatPoints } from '@/lib/money';
import type { PartnerNode } from '@/lib/types';
import { cn } from '@/lib/utils';

const modes = ['COMMISSION_ONLY', 'FULL_PASS', 'SPLIT_KEEP'] as const;

export default function HierarchyPage() {
  const user = useAuth((state) => state.user);
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<(typeof modes)[number]>('COMMISSION_ONLY');
  const [rates, setRates] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const tree = useQuery({ queryKey: ['hierarchy'], queryFn: () => api.hierarchy() });
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.categories() });
  const ledger = useQuery({ queryKey: ['ledger', page], queryFn: () => api.ledger(page) });
  const selected = useMemo(() => (selectedId ? findNode(tree.data ?? [], selectedId) : null), [tree.data, selectedId]);

  useEffect(() => {
    if (!selectedId && tree.data && tree.data[0]) {
      setSelectedId(tree.data[0].id);
    }
  }, [tree.data, selectedId]);

  useEffect(() => {
    if (!selected) {
      return;
    }
    setMode(selected.distributionMode);
    const next: Record<string, string> = {};
    for (const category of categories.data ?? []) {
      next[category.code] = selected.commissionRates[category.code] ?? '0.0000';
    }
    setRates(next);
    setNotice(null);
    setFormError(null);
  }, [selected, categories.data]);

  const canEdit =
    user?.role === 'SUPER_ADMIN' ||
    (user?.role === 'MASTER_PARTNER' && Boolean(selected) && selected?.id !== user.partnerId);

  const save = useMutation({
    mutationFn: async () => {
      if (!selected) {
        throw new ApiError(400, copy.hierarchy.pick);
      }
      const commissionRates: Record<string, string> = {};
      for (const [code, value] of Object.entries(rates)) {
        if (!/^\d+(\.\d+)?$/.test(value)) {
          throw new ApiError(400, copy.errors.validation);
        }
        const parsed = new Decimal(value);
        if (parsed.lt(0) || parsed.gte(10)) {
          throw new ApiError(400, copy.errors.validation);
        }
        commissionRates[code] = parsed.toFixed(4);
      }
      return api.updateCommercial(selected.id, { distributionMode: mode, commissionRates });
    },
    onSuccess: async () => {
      setNotice(copy.hierarchy.saved);
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['hierarchy'] });
    },
    onError: (error: Error) => {
      setNotice(null);
      setFormError(error instanceof ApiError ? error.message : copy.errors.generic);
    },
  });

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{copy.hierarchy.title}</h1>
      <div className="mt-3 flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/hierarchy/tree">{copy.hierarchy.tree}</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/reports/commission">{copy.hierarchy.report}</Link>
        </Button>
      </div>
      {tree.isLoading ? <StatePanel title={copy.catalog.loading} /> : null}
      {tree.isError ? <StatePanel title={copy.hierarchy.error} onRetry={() => void tree.refetch()} /> : null}
      {tree.isSuccess && tree.data.length === 0 ? <StatePanel title={copy.hierarchy.empty} /> : null}

      {tree.data && tree.data.length > 0 ? (
        <Card className="p-3">
          {tree.data.map((node) => (
            <PartnerBranch key={node.id} node={node} depth={0} selectedId={selectedId} onSelect={setSelectedId} />
          ))}
        </Card>
      ) : null}

      {selected ? (
        <Card className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-brass">{selected.code}</p>
              <h2 className="text-lg font-semibold">{selected.name}</h2>
            </div>
            <Badge className={selected.isActive ? 'bg-pine-soft text-pine' : 'bg-danger-soft text-danger'}>
              {selected.isActive ? copy.hierarchy.active : copy.hierarchy.inactive}
            </Badge>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mode">{copy.hierarchy.mode}</Label>
            <select
              id="mode"
              className="h-11 w-full rounded-2xl border border-line bg-paper px-3 text-sm text-white"
              value={mode}
              disabled={!canEdit}
              onChange={(event) => setMode(event.target.value as (typeof modes)[number])}
            >
              {modes.map((item) => (
                <option key={item} value={item}>
                  {modeLabel(item)}
                </option>
              ))}
            </select>
            <p className="text-xs leading-5 text-ink/60">{copy.modeHelp[mode]}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{copy.hierarchy.rates}</p>
            {(categories.data ?? []).map((category) => (
              <div key={category.code} className="grid grid-cols-[1fr_7rem] items-center gap-2">
                <Label htmlFor={`rate-${category.code}`}>
                  {category.name}
                  <span className="ml-2 font-mono text-xs text-ink/45">{category.code}</span>
                </Label>
                <Input
                  id={`rate-${category.code}`}
                  inputMode="decimal"
                  disabled={!canEdit}
                  value={rates[category.code] ?? '0.0000'}
                  onChange={(event) => setRates((current) => ({ ...current, [category.code]: event.target.value }))}
                />
              </div>
            ))}
            {categories.isError ? <p className="text-sm text-danger">{copy.catalog.error}</p> : null}
          </div>
          {!canEdit ? (
            <p className="text-xs leading-5 text-ink/60">
              {user?.role === 'MASTER_PARTNER' && selected.id === user.partnerId
                ? copy.hierarchy.selfLocked
                : copy.hierarchy.viewerLocked}
            </p>
          ) : null}
          {notice ? <p className="text-sm text-pine">{notice}</p> : null}
          {formError ? <p className="rounded-2xl bg-danger-soft px-3 py-2 text-sm text-danger">{formError}</p> : null}
          <Button disabled={!canEdit || save.isPending || !categories.isSuccess} onClick={() => save.mutate()}>
            {save.isPending ? copy.hierarchy.saving : copy.hierarchy.save}
          </Button>
        </Card>
      ) : tree.isSuccess ? (
        <StatePanel title={copy.hierarchy.pick} />
      ) : null}

      <div>
        <h2 className="text-lg font-semibold">{copy.hierarchy.ledger}</h2>
        {ledger.isLoading ? <div className="mt-3"><StatePanel title={copy.catalog.loading} /></div> : null}
        {ledger.isError ? (
          <div className="mt-3">
            <StatePanel title={copy.hierarchy.ledgerError} onRetry={() => void ledger.refetch()} />
          </div>
        ) : null}
        {ledger.isSuccess && ledger.data.rows.length === 0 ? (
          <div className="mt-3">
            <StatePanel title={copy.hierarchy.ledgerEmpty} />
          </div>
        ) : null}
        {ledger.data ? (
          <Card className="mt-3 p-4">
            <div className="flex flex-wrap gap-3 text-xs">
              <span>
                {copy.hierarchy.grandDebit} <strong className="font-mono">{formatPoints(ledger.data.grandDebit)}</strong>
              </span>
              <span>
                {copy.hierarchy.grandCredit} <strong className="font-mono">{formatPoints(ledger.data.grandCredit)}</strong>
              </span>
              <Badge className={ledger.data.balanced ? 'bg-pine-soft text-pine' : 'bg-danger-soft text-danger'}>
                {ledger.data.balanced ? copy.hierarchy.balanced : copy.hierarchy.unbalanced}
              </Badge>
            </div>
            <div className="mt-3 space-y-3">
              {ledger.data.rows.map((group) => (
                <article key={group.transactionId} className="rounded-2xl border border-line p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-[11px] text-ink/50">{group.txHash ?? group.transactionId}</p>
                    <Badge className={group.balanced ? 'bg-pine-soft text-pine' : 'bg-danger-soft text-danger'}>
                      {group.balanced ? copy.hierarchy.balanced : copy.hierarchy.unbalanced}
                    </Badge>
                  </div>
                  {group.status ? <p className="mt-1 text-xs">{statusLabel(group.status)}</p> : null}
                  <ul className="mt-2 space-y-2">
                    {group.entries.map((entry) => (
                      <li key={entry.id} className="grid grid-cols-2 gap-1 text-xs">
                        <span>
                          {copy.accounts[entry.accountType]}
                          <span className="mt-0.5 block font-mono text-[10px] text-ink/45">{entry.accountCode}</span>
                        </span>
                        <span className="text-right">
                          <span className="block">
                            {copy.hierarchy.debit} {formatPoints(entry.debit)}
                          </span>
                          <span className="block">
                            {copy.hierarchy.credit} {formatPoints(entry.credit)}
                          </span>
                          <span className="block text-ink/55">{memoLabel(entry.memo)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                {copy.hierarchy.previous}
              </Button>
              <span className="text-xs">
                {copy.hierarchy.page} {ledger.data.page}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page * ledger.data.pageSize >= ledger.data.total}
                onClick={() => setPage((current) => current + 1)}
              >
                {copy.hierarchy.next}
              </Button>
            </div>
          </Card>
        ) : null}
      </div>
    </section>
  );
}

function PartnerBranch({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: PartnerNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={cn(
          'flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left',
          selectedId === node.id ? 'bg-brass-soft' : 'hover:bg-paper',
        )}
        style={{ marginLeft: depth * 12 }}
      >
        <span>
          <span className="block text-sm font-medium">{node.name}</span>
          <span className="font-mono text-[11px] text-ink/50">{node.code}</span>
        </span>
        <span className="text-[11px] text-ink/60">{modeLabel(node.distributionMode)}</span>
      </button>
      {node.children.map((child) => (
        <PartnerBranch key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}

function findNode(nodes: PartnerNode[], id: string): PartnerNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    const child = findNode(node.children, id);
    if (child) {
      return child;
    }
  }
  return null;
}
