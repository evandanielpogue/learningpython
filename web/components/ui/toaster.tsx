'use client';

import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      offset={20}
      mobileOffset={{ bottom: 84 }}
      toastOptions={{
        classNames: {
          toast: '!rounded-[12px] !bg-night !text-night-ink !border-night-line !shadow-e4 !font-sans !text-[13.5px]',
          description: '!text-night-ink-2',
          actionButton: '!bg-sea-bright !text-sea-ink !font-semibold',
        },
      }}
    />
  );
}

export { toast } from 'sonner';
