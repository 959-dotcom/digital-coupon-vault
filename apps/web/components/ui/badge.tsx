import { cn } from '@/lib/utils';

export function Badge({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full bg-brass-soft px-2.5 py-1 text-[11px] font-semibold tracking-wide text-brass', className)}
      {...props}
    />
  );
}
