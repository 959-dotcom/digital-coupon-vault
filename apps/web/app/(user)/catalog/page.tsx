'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { StatePanel } from '@/components/state-panel';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { copy } from '@/lib/copy';

export default function CatalogPage() {
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.categories() });

  return (
    <section>
      <h1 className="text-2xl font-semibold">{copy.catalog.title}</h1>
      <div className="mt-4 space-y-3">
        {categories.isLoading ? <StatePanel title={copy.catalog.loading} /> : null}
        {categories.isError ? <StatePanel title={copy.catalog.error} onRetry={() => void categories.refetch()} /> : null}
        {categories.isSuccess && categories.data.length === 0 ? <StatePanel title={copy.catalog.empty} /> : null}
        {categories.data?.map((category) => {
          const open = category.batches.some((batch) => batch.isOpen && !batch.pastCutoff);
          return (
            <Link key={category.id} href={`/catalog/${category.id}`} className="block">
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-brass">{category.code}</p>
                    <h2 className="mt-1 text-lg font-semibold">{category.name}</h2>
                    <p className="mt-1 text-sm leading-6 text-ink/70">{category.description}</p>
                  </div>
                  <Badge className={open ? 'bg-pine-soft text-pine' : 'bg-danger-soft text-danger'}>
                    {open ? copy.catalog.open : copy.catalog.closed}
                  </Badge>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
