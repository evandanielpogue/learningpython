import { cn } from '@/lib/utils';

/* A door with the sun coming through it. Ink door, sea light, sand step. */
export function Mark({ size = 28, className, onDark = false }: { size?: number; className?: string; onDark?: boolean }) {
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} className={cn('shrink-0', className)} aria-hidden="true">
      <rect x="4" y="3" width="15" height="21" rx="3.5" fill={onDark ? '#f1f6f9' : 'var(--night)'} />
      <rect x="20.5" y="3" width="3.5" height="21" rx="1.75" fill="var(--sea-bright)" />
      <circle cx="15" cy="14" r="1.5" fill={onDark ? 'var(--night)' : '#fff'} />
      <rect x="3" y="24" width="22" height="2.2" rx="1.1" fill="var(--sand-strong)" />
    </svg>
  );
}

export function Wordmark({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <Mark onDark={onDark} />
      <b className={cn('text-[16px] font-[680] tracking-[-.03em]', onDark ? 'text-night-ink' : 'text-ink')}>Frontdoor</b>
    </span>
  );
}
