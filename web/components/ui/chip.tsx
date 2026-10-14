import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const chipVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full font-medium leading-none',
  {
    variants: {
      tone: {
        neutral: 'bg-sunk text-ink-2',
        sea: 'bg-sea-wash text-sea-deep',
        sand: 'bg-sand-wash text-sand-ink',
        pos: 'bg-pos-wash text-pos',
        warn: 'bg-warn-wash text-warn',
        neg: 'bg-neg-wash text-neg',
        night: 'bg-night-2 text-night-ink-2',
      },
      size: {
        sm: 'h-5 px-2 text-[11px]',
        md: 'h-6 px-2.5 text-[12px]',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  },
);

export function Chip({
  className,
  tone,
  size,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof chipVariants>) {
  return <span className={cn(chipVariants({ tone, size }), className)} {...props} />;
}
