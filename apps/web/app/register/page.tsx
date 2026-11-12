'use client';

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, api } from '@/lib/api';
import { copy } from '@/lib/copy';

const banks = Object.entries(copy.banks);
const sources = Object.entries(copy.sources);

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const ref = params.get('ref') ?? '';
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [bankProvider, setBankProvider] = useState('KBANK');
  const [accountNumber, setAccountNumber] = useState('');
  const [lineId, setLineId] = useState('');
  const [sourceChannel, setSourceChannel] = useState('FRIEND');
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const register = useMutation({
    mutationFn: () =>
      api.register({
        phone: phone.trim(),
        pin,
        pinConfirm,
        bankProvider,
        accountNumber: accountNumber.trim(),
        fullName: fullName.trim(),
        lineId: lineId.trim() || undefined,
        sourceChannel,
        ref: ref || undefined,
      }),
    onSuccess: () => setDone(true),
    onError: (error: Error) => setFormError(error instanceof ApiError ? error.message : copy.errors.generic),
  });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center px-4 py-8">
      <Card className="w-full p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brass">{copy.brand}</p>
        <h1 className="mt-2 text-2xl font-semibold">{copy.register.title}</h1>
        {done ? (
          <div className="mt-6 space-y-4">
            <p>{copy.register.done}</p>
            <Button className="h-12" onClick={() => router.push('/login')}>{copy.register.login}</Button>
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              if (pin !== pinConfirm) {
                setFormError(copy.errors.validation);
                return;
              }
              register.mutate();
            }}
          >
            <Field id="name" label={copy.register.fullName} required>
              <Input id="name" className="h-12" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
            </Field>
            <Field id="phone" label={copy.register.phone} required>
              <Input id="phone" className="h-12" inputMode="numeric" maxLength={10} value={phone} onChange={(event) => setPhone(event.target.value)} required />
            </Field>
            <Field id="pin" label={copy.register.pin} required>
              <Input id="pin" className="h-12" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value)} required />
            </Field>
            <Field id="pin-confirm" label={copy.register.pinConfirm} required>
              <Input id="pin-confirm" className="h-12" type="password" inputMode="numeric" maxLength={6} value={pinConfirm} onChange={(event) => setPinConfirm(event.target.value)} required />
            </Field>
            <Field id="bank" label={copy.register.bank} required>
              <select id="bank" className="h-12 w-full rounded-2xl border border-line bg-paper px-3 text-base text-white" value={bankProvider} onChange={(event) => setBankProvider(event.target.value)}>
                {banks.map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </Field>
            <Field id="account" label={copy.register.account} required>
              <Input id="account" className="h-12" inputMode="numeric" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} required />
            </Field>
            <Field id="line" label={copy.register.line}>
              <Input id="line" className="h-12" value={lineId} onChange={(event) => setLineId(event.target.value)} placeholder={copy.register.optional} />
            </Field>
            <Field id="source" label={copy.register.source} required>
              <select id="source" className="h-12 w-full rounded-2xl border border-line bg-paper px-3 text-base text-white" value={sourceChannel} onChange={(event) => setSourceChannel(event.target.value)}>
                {sources.map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </Field>
            {formError ? <p className="text-sm text-[#dc2626]">{formError}</p> : null}
            <Button type="submit" className="h-12 w-full" disabled={register.isPending}>{register.isPending ? copy.register.submitting : copy.register.submit}</Button>
            <Link href="/login" className="block text-sm text-white/70">{copy.register.login}</Link>
          </form>
        )}
      </Card>
    </main>
  );
}

function Field({ id, label, required, children }: { id: string; label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="ml-1 text-[#dc2626]">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<p className="px-5 py-16 text-center text-sm text-white/60">{copy.states.loading}</p>}>
      <RegisterForm />
    </Suspense>
  );
}
