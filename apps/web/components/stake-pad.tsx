'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { copy } from '@/lib/copy';
import { STAKE_BUTTONS, parseFreeBaht } from '@/lib/slip-lines';
import { cn } from '@/lib/utils';

export function StakePad({
  disabled,
  onAmount,
  onReverse,
}: {
  disabled: boolean;
  onAmount: (amount: string) => void;
  onReverse: (amount: string) => void;
}) {
  const [free, setFree] = useState('');
  const [lastAmount, setLastAmount] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function remember(amount: string) {
    setLastAmount(amount);
    setNotice(null);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {STAKE_BUTTONS.map((amount) => (
          <button
            key={amount}
            type="button"
            disabled={disabled}
            onClick={() => {
              const stored = `${amount}.0000`;
              remember(stored);
              onAmount(stored);
            }}
            className={cn(
              'min-h-14 rounded-2xl border border-line bg-[#0a0a0a] text-lg font-semibold text-white active:bg-[#dc2626] disabled:opacity-40',
            )}
          >
            {amount}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          inputMode="decimal"
          className="h-14 text-lg"
          placeholder={copy.selection.free}
          value={free}
          onChange={(event) => setFree(event.target.value)}
          aria-label={copy.selection.free}
        />
        <Button
          type="button"
          variant="outline"
          className="h-14 min-w-28"
          disabled={disabled}
          onClick={() => {
            const amount = parseFreeBaht(free);
            if (!amount) {
              setNotice(copy.selection.badAmount);
              return;
            }
            remember(amount);
            onAmount(amount);
          }}
        >
          {copy.selection.add}
        </Button>
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-14 w-full"
        disabled={disabled}
        onClick={() => {
          const amount = parseFreeBaht(free) ?? lastAmount;
          if (!amount) {
            setNotice(copy.selection.needAmount);
            return;
          }
          setNotice(null);
          onReverse(amount);
        }}
      >
        {copy.selection.reverse}
      </Button>
      {notice ? <p className="text-sm text-[#dc2626]">{notice}</p> : null}
    </div>
  );
}
