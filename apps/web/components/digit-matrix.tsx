'use client';

import { copy } from '@/lib/copy';
import { cn } from '@/lib/utils';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const;

export function DigitMatrix({
  length,
  value,
  onChange,
}: {
  length: number;
  value: string;
  onChange: (next: string) => void;
}) {
  const slots = Array.from({ length }, (_, index) => value[index] ?? '');

  function press(key: (typeof KEYS)[number]) {
    if (key === 'clear') {
      onChange('');
      return;
    }
    if (key === 'back') {
      onChange(value.slice(0, -1));
      return;
    }
    if (value.length >= length) {
      return;
    }
    onChange(`${value}${key}`);
  }

  return (
    <div>
      <div className="flex justify-center gap-2" aria-label={copy.selection.number}>
        {slots.map((slot, index) => (
          <span
            key={index}
            className="flex h-14 w-12 items-center justify-center rounded-2xl border border-line bg-[#0a0a0a] font-mono text-2xl text-white"
          >
            {slot || '·'}
          </span>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-label={key === 'clear' ? copy.selection.clear : key === 'back' ? copy.selection.deleteDigit : key}
            onClick={() => press(key)}
            className={cn(
              'h-14 rounded-2xl border text-white active:bg-[#dc2626]',
              key === 'clear' || key === 'back'
                ? 'border-line bg-card text-sm font-semibold'
                : 'border-line bg-[#0a0a0a] font-mono text-2xl',
            )}
          >
            {key === 'clear' ? copy.selection.clear : key === 'back' ? copy.selection.deleteDigit : key}
          </button>
        ))}
      </div>
    </div>
  );
}
