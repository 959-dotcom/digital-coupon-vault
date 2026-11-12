'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { copy } from '@/lib/copy';

export default function MoneyPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{copy.money.title}</h1>
      <Button asChild className="h-14 w-full text-base">
        <Link href="/deposit">{copy.money.deposit}</Link>
      </Button>
      <Button asChild variant="outline" className="h-14 w-full text-base">
        <Link href="/withdraw">{copy.money.withdraw}</Link>
      </Button>
    </section>
  );
}
