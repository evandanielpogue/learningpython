'use client';

import * as React from 'react';
import { Dialog as D, AlertDialog as A } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

const overlay =
  'fixed inset-0 z-50 bg-night/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 ' +
  'data-[state=closed]:animate-out data-[state=closed]:fade-out-0';
const panel =
  'fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 ' +
  'rounded-[16px] border border-line bg-panel p-6 shadow-e4 ' +
  'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 ' +
  'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({ className, children, ...props }: React.ComponentProps<typeof D.Content>) {
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content className={cn(panel, className)} {...props}>
        {children}
        <D.Close className="absolute right-4 top-4 rounded-md p-1 text-ink-3 hover:bg-sunk hover:text-ink" aria-label="Close">
          <X className="size-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}
export function DialogTitle({ className, ...props }: React.ComponentProps<typeof D.Title>) {
  return <D.Title className={cn('text-[17px] font-semibold tracking-[-.015em]', className)} {...props} />;
}
export function DialogDescription({ className, ...props }: React.ComponentProps<typeof D.Description>) {
  return <D.Description className={cn('text-[13.5px] text-ink-2', className)} {...props} />;
}

/* One confirm for anything destructive. */
export function Confirm({
  open,
  onOpenChange,
  title,
  body,
  confirm,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  body: string;
  confirm: string;
  onConfirm: () => void;
}) {
  return (
    <A.Root open={open} onOpenChange={onOpenChange}>
      <A.Portal>
        <A.Overlay className={overlay} />
        <A.Content className={panel}>
          <A.Title className="text-[17px] font-semibold tracking-[-.015em]">{title}</A.Title>
          <A.Description className="text-[13.5px] text-ink-2">{body}</A.Description>
          <div className="flex justify-end gap-2">
            <A.Cancel asChild>
              <Button variant="ghost">Cancel</Button>
            </A.Cancel>
            <A.Action asChild>
              <Button variant="danger" onClick={onConfirm}>
                {confirm}
              </Button>
            </A.Action>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}
