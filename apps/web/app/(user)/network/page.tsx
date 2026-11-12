'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { StatePanel } from '@/components/state-panel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { copy } from '@/lib/copy';
import type { LineNode } from '@/lib/types';

export default function NetworkPage() {
  const user = useAuth((state) => state.user);
  const queryClient = useQueryClient();
  const tree = useQuery({ queryKey: ['network'], queryFn: () => api.network() });
  const [selected, setSelected] = useState<LineNode | null>(null);
  const [hold, setHold] = useState('0.00');
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [commissionOnly, setCommissionOnly] = useState(false);

  const saveHold = useMutation({
    mutationFn: () => api.updateHold((selected ?? tree.data?.[0])?.id ?? '', hold),
    onSuccess: async () => {
      setNotice(copy.hierarchy.saved);
      await queryClient.invalidateQueries({ queryKey: ['network'] });
    },
    onError: (error: Error) => setFormError(error instanceof ApiError ? error.message : copy.errors.generic),
  });

  const createChild = useMutation({
    mutationFn: () =>
      api.createDownline({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        commissionOnly,
      }),
    onSuccess: async () => {
      setEmail('');
      setPassword('');
      setDisplayName('');
      setNotice(copy.register.done);
      await queryClient.invalidateQueries({ queryKey: ['network'] });
    },
    onError: (error: Error) => setFormError(error instanceof ApiError ? error.message : copy.errors.generic),
  });

  const toggleMode = useMutation({
    mutationFn: (node: LineNode) => api.updateAccountMode(node.id, !node.commissionOnly),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['network'] });
    },
    onError: (error: Error) => setFormError(error instanceof ApiError ? error.message : copy.errors.generic),
  });

  if (tree.isLoading) {
    return <StatePanel title={copy.states.loading} />;
  }
  if (tree.isError) {
    return <StatePanel title={copy.errors.generic} />;
  }

  const current = selected ?? tree.data?.[0] ?? null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{copy.network.title}</h1>
      <Card className="p-4">
        {(tree.data ?? []).map((node) => (
          <LineBranch key={node.id} node={node} depth={0} onPick={(item) => { setSelected(item); setHold(item.holdPercent); setNotice(null); setFormError(null); }} />
        ))}
      </Card>
      {current ? (
        <Card className="space-y-3 p-4 text-sm">
          <p className="font-semibold">{current.displayName}</p>
          <p>{copy.network.credit}: {current.credit}</p>
          <p>{copy.network.sales}: {current.sales}</p>
          <p>{copy.network.commission}: {current.commission}</p>
          <p>{current.commissionOnly ? copy.network.commissionOnly : copy.network.fullAccess}</p>
          <form
            className="space-y-3"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              setFormError(null);
              saveHold.mutate();
            }}
          >
            <Label htmlFor="hold">{copy.network.hold}</Label>
            <Input id="hold" value={hold} onChange={(event) => setHold(event.target.value)} />
            <div className="flex gap-2">
              <Button type="submit" size="sm">{copy.network.saveHold}</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setHold('0.00')}>{copy.network.zero}</Button>
            </div>
          </form>
          {user?.role === 'SUPER_ADMIN' || current.id !== user?.userId ? (
            <Button size="sm" variant="outline" onClick={() => toggleMode.mutate(current)}>
              {copy.network.mode}
            </Button>
          ) : null}
          {notice ? <p>{notice}</p> : null}
          {formError ? <p className="text-[#dc2626]">{formError}</p> : null}
        </Card>
      ) : null}
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">{copy.network.downline}</h2>
        <form
          className="space-y-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            setFormError(null);
            createChild.mutate();
          }}
        >
          <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={copy.register.name} required />
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={copy.register.email} required />
          <Input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={copy.register.password} required />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={commissionOnly} onChange={(event) => setCommissionOnly(event.target.checked)} />
            {copy.network.commissionOnly}
          </label>
          <Button type="submit" disabled={createChild.isPending}>{copy.network.create}</Button>
        </form>
      </Card>
    </div>
  );
}

function LineBranch({ node, depth, onPick }: { node: LineNode; depth: number; onPick: (node: LineNode) => void }) {
  const [open, setOpen] = useState(depth < 2);
  return (
    <div className="border-l border-white/10 pl-3" style={{ marginLeft: depth ? 8 : 0 }}>
      <button type="button" className="flex w-full items-center justify-between py-2 text-left" onClick={() => onPick(node)}>
        <span>
          <span className="font-medium">{node.displayName}</span>
          <span className="ml-2 text-white/50">{node.holdPercent}%</span>
        </span>
        {node.children.length > 0 ? (
          <span className="text-xs text-white/50" onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }}>
            {open ? '−' : '+'} {node.children.length}
          </span>
        ) : null}
      </button>
      {open ? node.children.map((child) => <LineBranch key={child.id} node={child} depth={depth + 1} onPick={onPick} />) : null}
    </div>
  );
}
