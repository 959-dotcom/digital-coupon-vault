import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('rounded-3xl border border-line bg-card shadow-[0_12px_40px_rgb(28_22_18_/_6%)]', className)} {...props} />;
}
