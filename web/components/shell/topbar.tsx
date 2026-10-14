import { cn } from '@/lib/utils';

/* The one header every screen has: a one-word title and its actions. */
export function Topbar({ title, children, className }: { title: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-panel/90 px-4 backdrop-blur-md md:px-8',
        className,
      )}
    >
      <h1 className="min-w-0 flex-1 truncate text-[17px] font-[660] tracking-[-.02em]">{title}</h1>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </header>
  );
}
