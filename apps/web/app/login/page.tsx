'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { useSessionReady } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { copy } from '@/lib/copy';

const samples = [
  ['member@vantage.local', copy.roles.MEMBER],
  ['shop@vantage.local', copy.roles.PARTNER],
  ['master@vantage.local', copy.roles.MASTER_PARTNER],
  ['admin@vantage.local', copy.roles.SUPER_ADMIN],
] as const;

export default function LoginPage() {
  const router = useRouter();
  const ready = useSessionReady();
  const user = useAuth((state) => state.user);
  const setSession = useAuth((state) => state.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && user) {
      router.replace(user.role === 'MEMBER' ? '/catalog' : '/hierarchy');
    }
  }, [ready, user, router]);

  const login = useMutation({
    mutationFn: () => api.login({ email: email.trim(), password }),
    onSuccess: (result) => {
      setSession(result.accessToken, result.user);
      router.replace(result.user.role === 'MEMBER' ? '/catalog' : '/hierarchy');
    },
    onError: (error: Error) => {
      setFormError(error instanceof ApiError ? error.message : copy.errors.generic);
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    login.mutate();
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brass">{copy.brand}</p>
      <h1 className="mt-2 text-3xl font-semibold leading-tight">{copy.tagline}</h1>
      <Card className="mt-6 p-5">
        <h2 className="text-lg font-semibold">{copy.login.title}</h2>
        <form className="mt-4 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="email">{copy.login.email}</Label>
            <Input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{copy.login.password}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />
          </div>
          {formError ? <p className="rounded-2xl bg-danger-soft px-3 py-2 text-sm text-danger">{formError}</p> : null}
          <Button className="w-full" type="submit" disabled={login.isPending}>
            {login.isPending ? copy.login.submitting : copy.login.submit}
          </Button>
        </form>
      </Card>
      <div className="mt-5 rounded-3xl border border-line bg-card/70 p-4 text-sm text-ink/70">
        <p>{copy.login.hint}</p>
        <p className="mt-3 font-medium text-ink">{copy.login.accounts}</p>
        <ul className="mt-2 space-y-1 font-mono text-xs">
          {samples.map(([address, role]) => (
            <li key={address}>
              {address} · {role}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
