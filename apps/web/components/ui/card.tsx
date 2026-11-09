import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-line bg-card text-white shadow-[0_0_40px_rgb(220_38_38_/_10%)]',
        className,
      )}
      {...props}
    />
  );
}
