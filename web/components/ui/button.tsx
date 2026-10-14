import * as React from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/* Primary is the bright sea with deep-sea ink: the one obvious next move.
   Everything else is quieter on purpose. */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-semibold select-none ' +
    'transition-[background,box-shadow,color,transform,border-color] duration-150 ease-fd ' +
    'active:scale-[.97] disabled:pointer-events-none disabled:opacity-45 ' +
    '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
  {
    variants: {
      variant: {
        primary:
          'bg-sea-bright text-sea-ink shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_1px_2px_rgba(4,50,74,.18),0_4px_14px_-4px_rgba(56,189,242,.6)] ' +
          'hover:bg-sea-bright-hover hover:shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_2px_4px_rgba(4,50,74,.2),0_8px_22px_-6px_rgba(56,189,242,.75)]',
        secondary: 'bg-panel text-ink border border-line-2 shadow-e1 hover:bg-sunk hover:border-line-3',
        ghost: 'text-ink-2 hover:bg-sunk hover:text-ink',
        link: 'text-sea underline-offset-4 hover:underline hover:text-sea-deep px-0',
        danger: 'bg-neg-wash text-neg hover:bg-neg hover:text-white',
        night: 'bg-night-2 text-night-ink hover:bg-night-3',
      },
      size: {
        sm: 'h-8 px-3 text-[13px] rounded-[9px]',
        md: 'h-9 px-4 text-[13.5px]',
        lg: 'h-11 px-5 text-[15px] rounded-[12px]',
        icon: 'size-8 rounded-[9px]',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : 'button';
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = 'Button';

export { buttonVariants };
