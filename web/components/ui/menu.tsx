'use client';

import * as React from 'react';
import { DropdownMenu as M } from 'radix-ui';
import { cn } from '@/lib/utils';

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;

export function MenuContent({ className, align = 'end', ...props }: React.ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={6}
        className={cn(
          'z-50 min-w-48 rounded-[12px] border border-line bg-panel p-1.5 shadow-e4 ' +
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 ' +
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          className,
        )}
        {...props}
      />
    </M.Portal>
  );
}

export function MenuItem({ className, danger, ...props }: React.ComponentProps<typeof M.Item> & { danger?: boolean }) {
  return (
    <M.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13.5px] outline-none ' +
          '[&_svg]:size-4 [&_svg]:text-ink-3',
        danger ? 'text-neg data-[highlighted]:bg-neg-wash [&_svg]:text-neg' : 'text-ink data-[highlighted]:bg-sunk',
        className,
      )}
      {...props}
    />
  );
}

export function MenuSeparator() {
  return <M.Separator className="my-1 h-px bg-line" />;
}
