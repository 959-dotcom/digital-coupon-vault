'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { StatePanel } from '@/components/state-panel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiError, api } from '@/lib/api';
import { copy } from '@/lib/copy';

export default function StaffPage() {
  const queryClient = useQueryClient();
  const staff = useQuery({ queryKey: ['staff'], queryFn: () => api.staff() });
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [viewBalance, setViewBalance] = useState(false);
  const [viewReports, setViewReports] = useState<'all' | 'downline' | 'none'>('none');
  const [manageCredit, setManageCredit] = useState(false);
  const [manageMembers, setManageMembers] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.createStaff({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        viewBalance,
        viewReports,
        manageCredit,
        manageMembers,
      }),
    onSuccess: async () => {
      setDisplayName('');
      setEmail('');
      setPassword('');
      await queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error: Error) => setFormError(error instanceof ApiError ? error.message : copy.errors.generic),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{copy.staff.title}</h1>
      {staff.isLoading ? <StatePanel title={copy.states.loading} /> : null}
      {staff.isError ? <StatePanel title={copy.errors.generic} /> : null}
      {staff.data && staff.data.length === 0 ? <StatePanel title={copy.staff.empty} /> : null}
      {staff.data?.map((row) => (
        <Card key={row.id} className="p-4 text-sm">
          <p className="font-medium">{row.displayName}</p>
          <p className="text-white/60">{row.email}</p>
          <p>
            {copy.staff.balance}: {row.permissions.viewBalance ? copy.products.open : copy.products.closed}
          </p>
          <p>
            {copy.staff.reports}:{' '}
            {row.permissions.viewReports === 'all'
              ? copy.staff.reportsAll
              : row.permissions.viewReports === 'downline'
                ? copy.staff.reportsDown
                : copy.staff.reportsNone}
          </p>
        </Card>
      ))}
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">{copy.staff.create}</h2>
        <form
          className="space-y-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            setFormError(null);
            create.mutate();
          }}
        >
          <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={copy.register.name} required />
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={copy.register.email} required />
          <Input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={copy.register.password} required />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={viewBalance} onChange={(event) => setViewBalance(event.target.checked)} />
            {copy.staff.balance}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={manageCredit} onChange={(event) => setManageCredit(event.target.checked)} />
            {copy.staff.credit}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={manageMembers} onChange={(event) => setManageMembers(event.target.checked)} />
            {copy.staff.members}
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={viewReports === 'all' ? 'default' : 'outline'} onClick={() => setViewReports('all')}>
              {copy.staff.reportsAll}
            </Button>
            <Button type="button" size="sm" variant={viewReports === 'downline' ? 'default' : 'outline'} onClick={() => setViewReports('downline')}>
              {copy.staff.reportsDown}
            </Button>
            <Button type="button" size="sm" variant={viewReports === 'none' ? 'default' : 'outline'} onClick={() => setViewReports('none')}>
              {copy.staff.reportsNone}
            </Button>
          </div>
          {formError ? <p className="text-sm text-[#dc2626]">{formError}</p> : null}
          <Button type="submit" disabled={create.isPending}>{copy.staff.create}</Button>
        </form>
      </Card>
    </div>
  );
}
