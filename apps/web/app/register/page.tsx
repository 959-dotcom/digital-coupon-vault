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

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const ref = params.get('ref') ?? '';
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const register = useMutation({
    mutationFn: () => api.register({ email: email.trim(), password, displayName: displayName.trim(), ref }),
    onSuccess: () => {
      setDone(true);
      setFormError(null);
    },
    onError: (error: Error) => {
      setFormError(error instanceof ApiError ? error.message : copy.errors.generic);
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ref) {
      setFormError(copy.register.missingRef);
      return;
    }
    register.mutate();
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center px-4 py-10">
      <Card className="w-full p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brass">{copy.brand}</p>
        <h1 className="mt-2 text-2xl font-semibold">{copy.register.title}</h1>
        {done ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-white/80">{copy.register.done}</p>
            <Button onClick={() => router.push('/login')}>{copy.register.login}</Button>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <Label htmlFor="name">{copy.register.name}</Label>
              <Input id="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
            </div>
            <div>
              <Label htmlFor="email">{copy.register.email}</Label>
              <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">{copy.register.password}</Label>
              <Input id="password" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            {formError ? <p className="text-sm text-[#dc2626]">{formError}</p> : null}
            <Button type="submit" disabled={register.isPending || ref.length === 0}>
              {register.isPending ? copy.register.submitting : copy.register.submit}
            </Button>
            {!ref ? <p className="text-sm text-white/60">{copy.register.missingRef}</p> : null}
            <Link href="/login" className="block text-sm text-white/70">
              {copy.register.login}
            </Link>
          </form>
        )}
      </Card>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<p className="px-5 py-16 text-center text-sm text-white/60">{copy.states.loading}</p>}>
      <RegisterForm />
    </Suspense>
  );
}
