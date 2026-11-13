'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { StatePanel } from '@/components/state-panel';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { copy } from '@/lib/copy';
import type { CategoryGroup } from '@/lib/types';

const GROUPS: CategoryGroup[] = ['NATIONAL', 'REGIONAL', 'FLASH', 'STOCK'];

const GROUP_LABEL: Record<CategoryGroup, string> = {
  NATIONAL: copy.catalog.national,
  REGIONAL: copy.catalog.regional,
  FLASH: copy.catalog.flash,
  STOCK: copy.catalog.stock,
};

export default function CatalogPage() {
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.categories(),
    refetchInterval: 15_000,
  });

  return (
    <section>
      <h1 className="text-2xl font-semibold">{copy.catalog.title}</h1>
      <div className="mt-4 space-y-6">
        {categories.isLoading ? <StatePanel title={copy.catalog.loading} /> : null}
        {categories.isError ? <StatePanel title={copy.catalog.error} onRetry={() => void categories.refetch()} /> : null}
        {categories.isSuccess && categories.data.length === 0 ? <StatePanel title={copy.catalog.empty} /> : null}
        {GROUPS.map((group) => {
          const rows = categories.data?.filter((category) => category.group === group) ?? [];
          if (rows.length === 0) {
            return null;
          }
          return (
            <div key={group}>
              <h2 className="text-sm font-semibold text-brass">{GROUP_LABEL[group]}</h2>
              <div className="mt-2 space-y-3">
                {rows.map((category) => {
                  const open = category.batches.some((batch) => batch.isOpen && !batch.pastCutoff && !batch.settled);
                  return (
                    <Link key={category.id} href={`/catalog/${category.id}`} className="block min-h-24 w-full text-left">
                      <Card className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-brass">{category.code}</p>
                            <h3 className="mt-1 text-xl font-semibold">{category.name}</h3>
                            <p className="mt-1 text-sm leading-6 text-ink/70">{category.description}</p>
                            <p className="mt-2 font-mono text-xs text-ink/60">
                              {copy.catalog.countdown} {formatCountdown(category.countdownSeconds)}
                            </p>
                          </div>
                          <Badge className={open ? 'bg-pine-soft text-pine' : 'bg-danger-soft text-danger'}>
                            {open ? copy.catalog.pick : copy.catalog.closed}
                          </Badge>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function formatCountdown(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return `${hours} ชม. ${minutes} นาที ${rest} วินาที`;
}
