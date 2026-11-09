'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { copy } from '@/lib/copy';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/75" />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-x-3 bottom-3 z-50 max-h-[88dvh] overflow-y-auto rounded-3xl border border-line bg-card p-5 text-white shadow-[0_0_48px_rgb(220_38_38_/_18%)] sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:w-[28rem] sm:-translate-x-1/2 sm:-translate-y-1/2',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full p-1 text-white/70 hover:bg-brass-soft" aria-label={copy.receipt.close}>
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('text-xl font-semibold text-white', className)} {...props} />;
}
