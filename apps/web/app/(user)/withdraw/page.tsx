'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, api } from '@/lib/api';
import { copy } from '@/lib/copy';
import { formatPoints } from '@/lib/money';

export default function WithdrawPage() {
  const queryClient = useQueryClient();
  const cash = useQuery({ queryKey: ['cash'], queryFn: () => api.cash() });
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api.profile() });
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const withdraw = useMutation({
    mutationFn: () => api.withdraw({ amount: toMoney(amount), pin }),
    onSuccess: async (row) => {
      setNotice(row.transferred ? copy.withdraw.queued : copy.withdraw.queued);
      setPin('');
      setAmount('');
      await queryClient.invalidateQueries({ queryKey: ['cash'] });
      await queryClient.invalidateQueries({ queryKey: ['withdrawals'] });
    },
    onError: (error: Error) => setFormError(error instanceof ApiError ? error.message : copy.errors.generic),
  });
  const bank = profile.data?.bankProvider ? copy.banks[profile.data.bankProvider as keyof typeof copy.banks] : null;
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{copy.withdraw.title}</h1>
      <Card className="p-4">
        <p className="text-sm text-white/60">{copy.withdraw.available}</p>
        <p className="font-mono text-3xl">{cash.isSuccess ? formatPoints(cash.data.available) : '…'}</p>
        <p className="mt-2 text-sm text-white/70">
          {bank && profile.data?.bankAccountNo ? `${copy.withdraw.account}: ${bank} ${profile.data.bankAccountNo}` : copy.withdraw.missingAccount}
        </p>
      </Card>
      <form
        className="space-y-3"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          setFormError(null);
          setNotice(null);
          if (!/^\d{6}$/.test(pin) || !/^\d{1,7}(\.\d{1,2})?$/.test(amount)) {
            setFormError(copy.errors.validation);
            return;
          }
          withdraw.mutate();
        }}
      >
        <Label htmlFor="withdraw-amount">{copy.withdraw.amount}</Label>
        <Input id="withdraw-amount" inputMode="decimal" className="h-12 text-lg" value={amount} onChange={(event) => setAmount(event.target.value)} />
        <Label htmlFor="withdraw-pin">{copy.withdraw.pin}</Label>
        <Input id="withdraw-pin" inputMode="numeric" autoComplete="off" maxLength={6} className="h-12 text-lg tracking-[0.4em]" type="password" value={pin} onChange={(event) => setPin(event.target.value)} />
        <Button type="submit" className="h-12 w-full" disabled={withdraw.isPending}>{copy.withdraw.submit}</Button>
      </form>
      {notice ? <p className="text-sm text-white/80">{notice}</p> : null}
      {formError ? <p className="text-sm text-[#dc2626]">{formError}</p> : null}
    </section>
  );
}

function toMoney(value: string): string {
  const [baht, fraction = ''] = value.split('.');
  return `${baht}.${fraction.padEnd(4, '0')}`;
}
