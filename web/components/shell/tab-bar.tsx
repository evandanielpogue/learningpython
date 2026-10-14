'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Plus, Settings, Compass } from 'lucide-react';
import { useStore } from '@/lib/data/store';
import { cn } from '@/lib/utils';

/* Phones: the rail becomes a bar along the bottom with the same places. */
export function TabBar() {
  const path = usePathname();
  const latest = useStore((s) => s.ws.opportunities.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0]);
  const items = [
    { href: '/opportunities', label: 'Opportunities', icon: LayoutGrid, active: path === '/opportunities' },
    ...(latest ? [{ href: `/o/${latest.id}`, label: latest.company, icon: Compass, active: path.startsWith('/o/') }] : []),
    { href: '/new', label: 'Add', icon: Plus, active: path === '/new' },
    { href: '/settings', label: 'Settings', icon: Settings, active: path === '/settings' },
  ];
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-night-line bg-night px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5 [color-scheme:dark] md:hidden"
    >
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={it.active ? 'page' : undefined}
          className={cn('flex min-w-0 flex-1 flex-col items-center gap-1 py-1 text-[11px] font-medium', it.active ? 'text-sea-glow' : 'text-night-ink-2')}
        >
          <it.icon className="size-5" aria-hidden="true" />
          <span className="max-w-full truncate px-1">{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}
