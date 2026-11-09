import Link from 'next/link';
import { copy } from '@/lib/copy';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
      <p className="text-lg font-semibold">{copy.states.notFound}</p>
      <Link href="/" className="mt-4 text-sm font-semibold text-pine">
        {copy.states.backHome}
      </Link>
    </div>
  );
}
