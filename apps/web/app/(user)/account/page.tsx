'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { copy, roleLabel } from '@/lib/copy';

export default function AccountPage() {
  const user = useAuth((state) => state.user);
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api.profile() });
  const settings = useQuery({
    queryKey: ['payments'],
    queryFn: () => api.paymentSettings(),
    enabled: user?.role === 'SUPER_ADMIN' && !user.isStaff,
  });
  const [currentPin, setCurrentPin] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [promptPayId, setPromptPayId] = useState('');
  const [chatId, setChatId] = useState('');
  const [token, setToken] = useState('');
  const [clearToken, setClearToken] = useState(false);
  const [rail, setRail] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings.data) {
      return;
    }
    setPromptPayId(settings.data.promptPayId);
    setChatId(settings.data.telegramChatId);
    setRail(settings.data.payoutRail);
  }, [settings.data]);

  const savePin = useMutation({
    mutationFn: () => api.changePin({ currentPin: currentPin || undefined, pin, pinConfirm }),
    onSuccess: () => {
      setNotice(copy.account.saved);
      setCurrentPin('');
      setPin('');
      setPinConfirm('');
      setFormError(null);
    },
    onError: (error: Error) => setFormError(error instanceof ApiError ? error.message : copy.errors.generic),
  });
  const saveSettings = useMutation({
    mutationFn: () =>
      api.savePaymentSettings({
        promptPayId,
        telegramChatId: chatId,
        telegramBotToken: token,
        clearTelegramToken: clearToken,
        payoutRail: rail,
      }),
    onSuccess: () => {
      setToken('');
      setNotice(copy.hierarchy.saved);
      setFormError(null);
    },
    onError: (error: Error) => setFormError(error instanceof ApiError ? error.message : copy.errors.generic),
  });

  const bank = profile.data?.bankProvider ? copy.banks[profile.data.bankProvider as keyof typeof copy.banks] : null;
  const source = profile.data?.sourceChannel ? copy.sources[profile.data.sourceChannel as keyof typeof copy.sources] : null;
  const principal = Boolean(user && !user.isStaff);
  const admin = user?.role === 'SUPER_ADMIN' && !user.isStaff;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{copy.account.title}</h1>
      <Card className="space-y-1 p-4 text-sm">
        <p className="text-lg font-semibold">{profile.data?.accountName ?? user?.displayName}</p>
        <p className="text-white/60">{user ? roleLabel(user.role) : ''}</p>
        {profile.data?.phone ? <p>{profile.data.phone}</p> : null}
        {bank ? <p>{bank} {profile.data?.bankAccountNo}</p> : null}
        {profile.data?.lineId ? <p>LINE {profile.data.lineId}</p> : null}
        {source ? <p>{source}</p> : null}
      </Card>
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">{copy.account.pin}</h2>
        <form
          className="space-y-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            savePin.mutate();
          }}
        >
          {profile.data?.hasPin ? (
            <Input className="h-12" inputMode="numeric" maxLength={6} type="password" value={currentPin} onChange={(event) => setCurrentPin(event.target.value)} placeholder={copy.account.currentPin} />
          ) : null}
          <Input className="h-12" inputMode="numeric" maxLength={6} type="password" value={pin} onChange={(event) => setPin(event.target.value)} placeholder={copy.account.newPin} required />
          <Input className="h-12" inputMode="numeric" maxLength={6} type="password" value={pinConfirm} onChange={(event) => setPinConfirm(event.target.value)} placeholder={copy.account.confirmPin} required />
          <Button type="submit" className="h-12 w-full" disabled={savePin.isPending}>{copy.account.savePin}</Button>
        </form>
      </Card>
      <div className="grid gap-2">
        {principal ? <NavLink href="/staff" label={copy.account.staff} /> : null}
        {user?.role !== 'MEMBER' ? <NavLink href="/hierarchy" label={copy.nav.hierarchy} /> : null}
        <NavLink href="/network" label={copy.nav.network} />
        <NavLink href="/hold" label={copy.nav.hold} />
        <NavLink href="/bills" label={copy.nav.bills} />
        <NavLink href="/products" label={copy.nav.products} />
        {!user?.commissionOnly ? <NavLink href="/catalog" label={copy.account.catalog} /> : null}
        {admin ? <NavLink href="/settlement" label={copy.nav.settlement} /> : null}
        {admin ? <NavLink href="/withdrawals" label={copy.nav.withdrawals} /> : null}
        {admin ? <NavLink href="/audit-logs" label={copy.nav.audit} /> : null}
      </div>
      {admin ? (
        <Card className="space-y-3 p-4">
          <h2 className="font-semibold">{copy.account.telegram}</h2>
          {settings.data && !settings.data.telegramConfigured ? <p className="text-sm text-white/70">{copy.account.telegramMissing}</p> : null}
          <form
            className="space-y-3"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              saveSettings.mutate();
            }}
          >
            <Label htmlFor="promptpay">{copy.account.promptPay}</Label>
            <Input id="promptpay" className="h-12" value={promptPayId} onChange={(event) => setPromptPayId(event.target.value)} />
            <Label htmlFor="chat">{copy.account.chat}</Label>
            <Input id="chat" className="h-12" value={chatId} onChange={(event) => setChatId(event.target.value)} />
            <Label htmlFor="token">{copy.account.token}</Label>
            <Input id="token" className="h-12" type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder={copy.account.tokenKeep} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={clearToken} onChange={(event) => setClearToken(event.target.checked)} />
              {copy.account.clearToken}
            </label>
            <Label htmlFor="rail">{copy.account.rail}</Label>
            <Input id="rail" className="h-12" value={rail} onChange={(event) => setRail(event.target.value)} />
            <p className="text-xs text-white/50">{copy.account.emptyRail}</p>
            <Button type="submit" className="h-12 w-full" disabled={saveSettings.isPending}>{copy.account.save}</Button>
          </form>
        </Card>
      ) : null}
      {notice ? <p className="text-sm">{notice}</p> : null}
      {formError ? <p className="text-sm text-[#dc2626]">{formError}</p> : null}
    </section>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="outline" className="h-12 justify-start">
      <Link href={href}>{label}</Link>
    </Button>
  );
}
