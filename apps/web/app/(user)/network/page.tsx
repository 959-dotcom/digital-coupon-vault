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
import { copy, roleLabel } from '@/lib/copy';
import type { LineNode, RoleName } from '@/lib/types';

function rolesFor(parentRole: string | undefined): RoleName[] {
  if (parentRole === 'SUPER_ADMIN') {
    return ['MASTER_PARTNER', 'PARTNER', 'MEMBER'];
  }
  if (parentRole === 'MASTER_PARTNER') {
    return ['PARTNER', 'MEMBER'];
  }
  return ['MEMBER'];
}

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
  const [createRole, setCreateRole] = useState<RoleName>(rolesFor(user?.role)[0] ?? 'MEMBER');
  const [createHold, setCreateHold] = useState('0.00');
  const [createActive, setCreateActive] = useState(true);
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState<RoleName>('MEMBER');
  const [memberCommission, setMemberCommission] = useState(false);
  const [memberHold, setMemberHold] = useState('0.00');
  const [memberActive, setMemberActive] = useState(true);
  const [nextPassword, setNextPassword] = useState('');
  const [issuedPassword, setIssuedPassword] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const canManage = !user?.isStaff || Boolean(user.permissions?.manageMembers);
  const roleChoices = rolesFor(user?.role);

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
        role: createRole,
        holdPercent: createHold,
        isActive: createActive,
      }),
    onSuccess: async () => {
      setIssuedPassword(password);
      setEmail('');
      setPassword('');
      setDisplayName('');
      setNotice(copy.register.done);
      await queryClient.invalidateQueries({ queryKey: ['network'] });
    },
    onError: (error: Error) => setFormError(error instanceof ApiError ? error.message : copy.errors.generic),
  });

  const saveMember = useMutation({
    mutationFn: (node: LineNode) =>
      api.updateMember(node.id, {
        displayName: memberName.trim(),
        role: memberRole,
        commissionOnly: memberCommission,
        holdPercent: memberHold,
        isActive: memberActive,
      }),
    onSuccess: async (saved) => {
      setNotice(copy.hierarchy.saved);
      setSelected((current) =>
        current && current.id === saved.id
          ? {
              ...current,
              displayName: saved.displayName,
              role: saved.role,
              commissionOnly: saved.commissionOnly,
              holdPercent: saved.holdPercent,
              isActive: saved.isActive,
            }
          : current,
      );
      await queryClient.invalidateQueries({ queryKey: ['network'] });
    },
    onError: (error: Error) => setFormError(error instanceof ApiError ? error.message : copy.errors.generic),
  });

  const resetPassword = useMutation({
    mutationFn: (node: LineNode) => api.resetPassword(node.id, nextPassword),
    onSuccess: (result) => {
      setIssuedPassword(result.password);
      setNextPassword('');
      setNotice(null);
    },
    onError: (error: Error) => setFormError(error instanceof ApiError ? error.message : copy.errors.generic),
  });

  const changeOwnPassword = useMutation({
    mutationFn: () => api.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setPasswordNotice(copy.network.passwordChanged);
      setFormError(null);
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

  const current = selected ?? tree.data?.[0] ?? null;
  const managing = Boolean(current?.direct && canManage);

  function pick(item: LineNode) {
    setSelected(item);
    setHold(item.holdPercent);
    setMemberName(item.displayName);
    setMemberRole(rolesFor(user?.role).includes(item.role as RoleName) ? (item.role as RoleName) : 'MEMBER');
    setMemberCommission(item.commissionOnly);
    setMemberHold(item.holdPercent);
    setMemberActive(item.isActive);
    setNotice(null);
    setFormError(null);
    setIssuedPassword(null);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{copy.network.title}</h1>
      {tree.isLoading ? <StatePanel title={copy.states.loading} /> : null}
      {tree.isError ? <StatePanel title={copy.errors.generic} onRetry={() => void tree.refetch()} /> : null}
      {tree.isSuccess ? (
      <Card className="p-4">
        {(tree.data ?? []).map((node) => (
          <LineBranch key={node.id} node={node} depth={0} onPick={pick} />
        ))}
      </Card>
      ) : null}
      {tree.isSuccess && current ? (
        <Card className="space-y-3 p-4 text-sm">
          <p className="font-semibold">{current.displayName}</p>
          <p>{copy.network.role}: {roleLabel(current.role)}</p>
          <p>{current.isActive ? copy.network.active : copy.network.suspended}</p>
          <p>{copy.network.credit}: {current.credit}</p>
          <p>{copy.network.sales}: {current.sales}</p>
          <p>{copy.network.commission}: {current.commission}</p>
          <p>{current.commissionOnly ? copy.network.commissionOnly : copy.network.fullAccess}</p>
          {managing ? (
            <form
              className="space-y-3"
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                setFormError(null);
                saveMember.mutate(current);
              }}
            >
              <Label htmlFor="member-name">{copy.register.name}</Label>
              <Input id="member-name" value={memberName} onChange={(event) => setMemberName(event.target.value)} required />
              <Label htmlFor="member-role">{copy.network.role}</Label>
              <select
                id="member-role"
                className="h-11 w-full rounded-2xl border border-line bg-paper px-3 text-sm text-white"
                value={memberRole}
                onChange={(event) => setMemberRole(event.target.value as RoleName)}
              >
                {roleChoices.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
              <Label htmlFor="member-hold">{copy.network.hold}</Label>
              <Input id="member-hold" value={memberHold} onChange={(event) => setMemberHold(event.target.value)} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={memberCommission} onChange={(event) => setMemberCommission(event.target.checked)} />
                {copy.network.commissionOnly}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={memberActive} onChange={(event) => setMemberActive(event.target.checked)} />
                {copy.network.active}
              </label>
              <Button type="submit" size="sm" disabled={saveMember.isPending}>
                {copy.network.saveMember}
              </Button>
            </form>
          ) : (
            <>
              {current.id === user?.userId ? null : <p className="text-xs text-white/50">{copy.network.directOnly}</p>}
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
            </>
          )}
          {managing ? (
            <form
              className="space-y-3"
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                setFormError(null);
                resetPassword.mutate(current);
              }}
            >
              <Label htmlFor="reset-password">{copy.network.resetPassword}</Label>
              <Input
                id="reset-password"
                type="password"
                minLength={8}
                value={nextPassword}
                onChange={(event) => setNextPassword(event.target.value)}
                required
              />
              <Button type="submit" size="sm" variant="outline" disabled={resetPassword.isPending}>
                {copy.network.reset}
              </Button>
            </form>
          ) : null}
          {issuedPassword ? (
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-xs text-white/60">{copy.network.issued}</p>
              <p className="mt-1 break-all font-mono text-sm">{issuedPassword}</p>
              <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => setIssuedPassword(null)}>
                {copy.network.dismiss}
              </Button>
            </div>
          ) : null}
          {notice ? <p>{notice}</p> : null}
          {formError ? <p className="text-[#dc2626]">{formError}</p> : null}
        </Card>
      ) : null}
      {canManage ? (
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
            <Label htmlFor="create-role">{copy.network.role}</Label>
            <select
              id="create-role"
              className="h-11 w-full rounded-2xl border border-line bg-paper px-3 text-sm text-white"
              value={createRole}
              onChange={(event) => setCreateRole(event.target.value as RoleName)}
            >
              {roleChoices.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
            <Label htmlFor="create-hold">{copy.network.hold}</Label>
            <Input id="create-hold" value={createHold} onChange={(event) => setCreateHold(event.target.value)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={commissionOnly} onChange={(event) => setCommissionOnly(event.target.checked)} />
              {copy.network.commissionOnly}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={createActive} onChange={(event) => setCreateActive(event.target.checked)} />
              {copy.network.active}
            </label>
            <Button type="submit" disabled={createChild.isPending}>{copy.network.create}</Button>
          </form>
        </Card>
      ) : null}
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">{copy.network.ownPassword}</h2>
        <form
          className="space-y-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            setFormError(null);
            setPasswordNotice(null);
            changeOwnPassword.mutate();
          }}
        >
          <Input
            type="password"
            minLength={8}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder={copy.network.currentPassword}
            autoComplete="current-password"
            required
          />
          <Input
            type="password"
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder={copy.network.newPassword}
            autoComplete="new-password"
            required
          />
          <Button type="submit" disabled={changeOwnPassword.isPending}>{copy.network.ownPassword}</Button>
        </form>
        {passwordNotice ? <p>{passwordNotice}</p> : null}
        {formError ? <p className="text-[#dc2626]">{formError}</p> : null}
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
          <span className="ml-2 text-white/50">{roleLabel(node.role)}</span>
          <span className="ml-2 text-white/50">{node.holdPercent}%</span>
          {node.isActive ? null : <span className="ml-2 text-[#dc2626]">{copy.network.suspended}</span>}
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
