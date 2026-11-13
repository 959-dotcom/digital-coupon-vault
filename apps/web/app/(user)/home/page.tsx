'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { copy } from '@/lib/copy';

export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/catalog');
  }, [router]);
  return <p className="px-5 py-16 text-center text-sm text-ink/60">{copy.states.loading}</p>;
}
