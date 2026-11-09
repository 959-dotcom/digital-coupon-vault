import * as React from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-2xl border border-line bg-card px-3 text-sm outline-none ring-brass/40 placeholder:text-ink/40 focus:ring-2',
        className,
      )}
      {...props}
    />
  );
}
