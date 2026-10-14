import * as React from 'react';
import { cn } from '@/lib/utils';

const base =
  'w-full min-w-0 rounded-[10px] border border-line-2 bg-panel text-ink shadow-e1 ' +
  'placeholder:text-ink-3 transition-[border-color,box-shadow] duration-150 ' +
  'hover:border-line-3 focus:outline-none focus:border-sea focus:shadow-[0_0_0_3px_var(--sea-tint)] ' +
  'aria-invalid:border-neg disabled:opacity-50';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(base, 'h-9 px-3 text-[13.5px]', className)} {...props} />,
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(base, 'min-h-24 px-3 py-2.5 text-[13.5px] leading-relaxed resize-y', className)} {...props} />
  ),
);
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        base,
        'h-9 appearance-none pl-3 pr-8 text-[13.5px] cursor-pointer bg-no-repeat bg-[right_12px_center] ' +
          "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5' fill='none' stroke='%235d6c77' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...props}
    />
  ),
);
Select.displayName = 'Select';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-[12.5px] font-medium text-ink-2', className)} {...props} />;
}

export function Field({ label, htmlFor, children, className }: { label: string; htmlFor: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid gap-1.5 min-w-0', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
