import { cn } from '@/lib/utils';
import { initialsOf } from './monogram';

export function Headshot({ photo, name, size = 40, className }: { photo: string | null; name: string; size?: number; className?: string }) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element -- data URLs and signed URLs, not optimisable assets
    return <img src={photo} alt={name} width={size} height={size} className={cn('shrink-0 rounded-full object-cover', className)} style={{ width: size, height: size }} />;
  }
  return (
    <span
      className={cn('grid shrink-0 place-items-center rounded-full bg-night font-semibold text-night-ink', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-label={name || 'You'}
    >
      {initialsOf(name || 'You')}
    </span>
  );
}
