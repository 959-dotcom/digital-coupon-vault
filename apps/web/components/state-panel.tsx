import { Button } from '@/components/ui/button';
import { copy } from '@/lib/copy';

export function StatePanel({
  title,
  onRetry,
}: {
  title: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-card/80 px-4 py-12 text-center">
      <p className="text-sm leading-6 text-ink/75">{title}</p>
      {onRetry ? (
        <Button className="mt-4" variant="outline" onClick={onRetry}>
          {copy.catalog.retry}
        </Button>
      ) : null}
    </div>
  );
}
