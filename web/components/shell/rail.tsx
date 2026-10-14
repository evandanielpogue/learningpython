'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Plus, Settings } from 'lucide-react';
import { useStore } from '@/lib/data/store';
import { Wordmark } from '@/components/brand/mark';
import { Monogram } from '@/components/brand/monogram';
import { Headshot } from '@/components/brand/headshot';
import { Ring } from '@/components/brand/ring';
import { progress } from '@/lib/journey';
import { cn } from '@/lib/utils';

function NavItem({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] font-medium transition-colors',
        active ? 'bg-night-2 text-night-ink' : 'text-night-ink-2 hover:bg-night-2/60 hover:text-night-ink',
      )}
    >
      {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-sea-bright" />}
      <span className={cn('grid size-5 place-items-center', active && 'text-sea-glow')}>{icon}</span>
      {label}
    </Link>
  );
}

export function Rail() {
  const path = usePathname();
  const ws = useStore((s) => s.ws);
  const recent = ws.opportunities.slice().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 7);

  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col gap-5 overflow-y-auto bg-night px-3 py-4 [color-scheme:dark] md:flex">
      <Link href="/opportunities" className="px-2 py-1">
        <Wordmark onDark />
      </Link>

      <Link
        href="/new"
        className="flex h-10 items-center justify-center gap-2 rounded-[10px] bg-sea-bright text-[14px] font-semibold text-sea-ink shadow-[0_6px_18px_-6px_rgba(56,189,242,.7)] transition hover:bg-sea-bright-hover active:scale-[.98]"
      >
        <Plus className="size-4" /> Add a company
      </Link>

      <nav className="grid gap-1" aria-label="Sections">
        <NavItem href="/opportunities" icon={<LayoutGrid className="size-[18px]" />} label="Opportunities" active={path === '/opportunities'} />
      </nav>

      {recent.length > 0 && (
        <div className="grid gap-0.5">
          <p className="px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[.08em] text-night-ink-2">Recent</p>
          {recent.map((o) => {
            const active = path === `/o/${o.id}`;
            const pr = progress(o);
            return (
              <Link
                key={o.id}
                href={`/o/${o.id}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 transition-colors',
                  active ? 'bg-night-2' : 'hover:bg-night-2/60',
                )}
              >
                <Ring done={pr.done} total={pr.total} size={32} stroke={2.5} track="rgba(255,255,255,.12)" fill="var(--sea-glow)">
                  <Monogram name={o.company} size={22} />
                </Ring>
                <span className="grid min-w-0">
                  <span className={cn('truncate text-[13.5px] font-medium', active ? 'text-night-ink' : 'text-night-ink-2 group-hover:text-night-ink')}>
                    {o.company}
                  </span>
                  <span className="truncate text-[11.5px] text-night-ink-2/80">{o.role || 'No role'}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-auto grid gap-1 border-t border-night-line pt-3">
        <NavItem href="/settings" icon={<Settings className="size-[18px]" />} label="Settings" active={path === '/settings'} />
        <div className="flex items-center gap-2.5 px-2 py-2">
          <Headshot photo={ws.profile.photo} name={ws.profile.name} size={30} />
          <span className="grid min-w-0">
            <span className="truncate text-[13px] font-semibold text-night-ink">{ws.profile.name || 'You'}</span>
            <span className="truncate text-[11.5px] text-night-ink-2">{ws.profile.email || 'Saved in this browser'}</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
