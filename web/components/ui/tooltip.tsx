'use client';

import * as React from 'react';
import { Tooltip as T } from 'radix-ui';

export function Tip({ label, children, side = 'right' }: { label: string; children: React.ReactNode; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <T.Provider delayDuration={250}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal>
          <T.Content
            side={side}
            sideOffset={8}
            className="z-50 rounded-[8px] bg-night px-2.5 py-1.5 text-[12px] font-medium text-night-ink shadow-e3 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0"
          >
            {label}
          </T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  );
}
