'use client';

import { Button } from '@/components/ui/button';
import { copy } from '@/lib/copy';

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
      <p className="text-lg font-semibold">{copy.states.appError}</p>
      <Button className="mt-4" onClick={reset}>
        {copy.catalog.retry}
      </Button>
    </div>
  );
}
