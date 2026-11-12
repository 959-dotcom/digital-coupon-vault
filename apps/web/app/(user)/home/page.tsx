'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { copy } from '@/lib/copy';
import { formatPoints } from '@/lib/money';

export default function HomePage() {
  const cash = useQuery({ queryKey: ['cash'], queryFn: () => api.cash() });
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{copy.home.title}</h1>
      <Card className="p-5">
        <p className="text-sm text-white/60">{copy.nav.balance}</p>
        <p className="mt-1 font-mono text-3xl font-semibold">{cash.isSuccess ? formatPoints(cash.data.available) : '…'}</p>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <Button asChild className="h-14 text-base">
          <Link href="/deposit">{copy.home.deposit}</Link>
        </Button>
        <Button asChild variant="outline" className="h-14 text-base">
          <Link href="/withdraw">{copy.home.withdraw}</Link>
        </Button>
      </div>
    </section>
  );
}
