import * as React from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-2xl border border-line bg-paper px-3 text-sm text-white outline-none ring-[#dc2626]/40 placeholder:text-white/40 focus:ring-2',
        className,
      )}
      {...props}
    />
  );
}
