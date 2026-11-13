'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSessionReady } from '@/components/app-shell';
import { useAuth } from '@/lib/auth-store';
import { copy } from '@/lib/copy';

export default function HomePage() {
  const ready = useSessionReady();
  const user = useAuth((state) => state.user);
  const router = useRouter();

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (!user) {
      router.replace('/login');
      return;
    }
    router.replace('/catalog');
  }, [ready, user, router]);

  return <p className="px-5 py-16 text-center text-sm text-ink/60">{copy.states.loading}</p>;
}
