'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatePanel } from '@/components/state-panel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ApiError, api } from '@/lib/api';
import { copy } from '@/lib/copy';
import { useState } from 'react';

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const products = useQuery({ queryKey: ['products'], queryFn: () => api.products() });
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const toggle = useMutation({
    mutationFn: (input: { code: string; isActive: boolean }) => api.setProduct(input.code, input.isActive),
    onSuccess: async () => {
      setNotice(copy.products.saved);
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error: Error) => setFormError(error instanceof ApiError ? error.message : copy.errors.generic),
  });

  if (products.isLoading) {
    return <StatePanel title={copy.states.loading} />;
  }
  if (products.isError || !products.data) {
    return <StatePanel title={copy.errors.generic} />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{copy.products.title}</h1>
      <p className="text-sm text-white/60">{copy.products.hint}</p>
      {products.data.map((product) => (
        <Card key={product.code} className="flex items-center justify-between gap-3 p-4">
          <div>
            <p className="font-medium">{product.name}</p>
            <p className="text-xs text-white/50">{product.isActive ? copy.products.open : copy.products.closed}</p>
          </div>
          <Button
            size="sm"
            variant={product.ownActive ? 'outline' : 'default'}
            onClick={() => {
              setFormError(null);
              toggle.mutate({ code: product.code, isActive: !product.ownActive });
            }}
          >
            {product.ownActive ? copy.products.closed : copy.products.open}
          </Button>
        </Card>
      ))}
      {notice ? <p className="text-sm">{notice}</p> : null}
      {formError ? <p className="text-sm text-[#dc2626]">{formError}</p> : null}
    </div>
  );
}
