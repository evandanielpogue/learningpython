'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, ArrowUpRight, Columns3, MoreHorizontal, Plus, Rows3, Search, Trash2 } from 'lucide-react';
import { useStore } from '@/lib/data/store';
import type { Opportunity, PhaseKey } from '@/lib/types';
import { PHASES } from '@/lib/types';
import { PHASE_LIST, PHASE_META, currentPhase, daysActive, lastTouch, progress, replies } from '@/lib/journey';
import { nextAction, relativeDay } from '@/lib/next-action';
import { Topbar } from '@/components/shell/topbar';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Confirm } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toaster';
import { Monogram } from '@/components/brand/monogram';
import { PhaseIcon } from '@/components/brand/phase-icon';
import { cn } from '@/lib/utils';

type SortKey = 'company' | 'step' | 'last' | 'replies' | 'days';
type View = 'table' | 'board';

function StepPill({ o }: { o: Opportunity }) {
  const phase = currentPhase(o);
  const all = o.done.length === PHASES.length;
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full pl-1.5 pr-2.5 text-[12.5px] font-medium',
        all ? 'bg-sand-wash text-sand-ink' : 'bg-sea-wash text-sea-deep',
      )}
    >
      <span className={cn('grid size-5 place-items-center rounded-full', all ? 'bg-sand' : 'bg-sea-tint')}>
        <PhaseIcon phase={phase} className="size-3" />
      </span>
      {PHASE_META[phase].label}
    </span>
  );
}

function Segments({ o }: { o: Opportunity }) {
  return (
    <span className="grid w-[84px] grid-cols-6 gap-[3px]" aria-label={`${progress(o).done} of 6 steps done`}>
      {PHASES.map((k) => (
        <i
          key={k}
          className={cn(
            'block h-[5px] rounded-full',
            o.done.includes(k) ? 'bg-sand-strong' : currentPhase(o) === k ? 'bg-sea-bright' : 'bg-sunk-2',
          )}
        />
      ))}
    </span>
  );
}

function RowMenu({ o, onRemove }: { o: Opportunity; onRemove: () => void }) {
  const router = useRouter();
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`More for ${o.company}`} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal />
        </Button>
      </MenuTrigger>
      <MenuContent onClick={(e) => e.stopPropagation()}>
        <MenuItem onSelect={() => router.push(`/o/${o.id}`)}>
          <ArrowUpRight /> Open
        </MenuItem>
        <MenuSeparator />
        <MenuItem danger onSelect={onRemove}>
          <Trash2 /> {o.example ? 'Remove example' : 'Remove'}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function Empty() {
  return (
    <div className="grid place-items-center px-4 py-24 text-center">
      <span className="mb-5 grid size-16 place-items-center rounded-[20px] bg-sea-wash text-sea shadow-e2">
        <PhaseIcon phase="upload" className="size-7" />
      </span>
      <h2 className="mb-5 text-[20px]">No companies yet</h2>
      <Button asChild variant="primary" size="lg">
        <Link href="/new">
          <Plus /> Add a company
        </Link>
      </Button>
    </div>
  );
}

export default function Opportunities() {
  const router = useRouter();
  const list = useStore((s) => s.ws.opportunities);
  const removeOpportunity = useStore((s) => s.removeOpportunity);
  const [view, setView] = useState<View>('table');
  const [q, setQ] = useState('');
  const [step, setStep] = useState<PhaseKey | 'all'>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'last', dir: -1 });
  const [dropping, setDropping] = useState<Opportunity | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = list.filter(
      (o) =>
        (step === 'all' || currentPhase(o) === step) &&
        (!needle || `${o.company} ${o.role} ${o.location}`.toLowerCase().includes(needle)),
    );
    const val = (o: Opportunity): string | number => {
      switch (sort.key) {
        case 'company':
          return o.company.toLowerCase();
        case 'step':
          return PHASES.indexOf(currentPhase(o)) * 10 + o.done.length;
        case 'last':
          return lastTouch(o) ?? o.updatedAt;
        case 'replies':
          return replies(o);
        case 'days':
          return daysActive(o);
      }
    };
    return filtered.slice().sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [list, q, step, sort]);

  function head(key: SortKey, label: string, className?: string) {
    const on = sort.key === key;
    return (
      <th className={cn('px-3 py-2.5 text-left font-semibold', className)}>
        <button
          className={cn('inline-flex items-center gap-1 rounded px-1 -mx-1 hover:text-ink', on && 'text-ink')}
          onClick={() => setSort({ key, dir: on ? (sort.dir === 1 ? -1 : 1) : key === 'company' ? 1 : -1 })}
          aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
        >
          {label}
          {on && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
        </button>
      </th>
    );
  }

  return (
    <>
      <Topbar title="Opportunities">
        <div className="hidden rounded-[10px] bg-sunk p-0.5 sm:flex" role="tablist" aria-label="View">
          {(['table', 'board'] as View[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium transition',
                view === v ? 'bg-panel text-ink shadow-e1' : 'text-ink-3 hover:text-ink',
              )}
            >
              {v === 'table' ? <Rows3 className="size-4" /> : <Columns3 className="size-4" />}
              {v === 'table' ? 'Table' : 'Board'}
            </button>
          ))}
        </div>
        <Button asChild variant="primary" className="md:hidden">
          <Link href="/new">
            <Plus /> Add
          </Link>
        </Button>
      </Topbar>

      <main className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-8">
        {!list.length ? (
          <Empty />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search" className="pl-9" />
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by step">
                {(['all', ...PHASES] as const).map((k) => {
                  const n = k === 'all' ? list.length : list.filter((o) => currentPhase(o) === k).length;
                  const on = step === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setStep(k)}
                      aria-pressed={on}
                      className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition',
                        on ? 'border-sea bg-sea-wash text-sea-deep' : 'border-line bg-panel text-ink-2 hover:border-line-3',
                      )}
                    >
                      {k === 'all' ? 'All' : PHASE_META[k].label}
                      <span className={cn('text-[11px]', on ? 'text-sea' : 'text-ink-3')}>{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {view === 'table' ? (
              <div className="overflow-hidden rounded-[12px] border border-line bg-panel shadow-e2">
                {/* desktop table */}
                <table className="hidden w-full text-[13.5px] md:table">
                  <thead className="border-b border-line bg-sunk/60 text-[12px] text-ink-3">
                    <tr>
                      {head('company', 'Company', 'pl-5')}
                      {head('step', 'Step')}
                      <th className="px-3 py-2.5 text-left font-semibold">Next</th>
                      {head('last', 'Last touch')}
                      {head('replies', 'Replies')}
                      {head('days', 'Days')}
                      <th className="w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((o) => (
                      <tr
                        key={o.id}
                        onClick={() => router.push(`/o/${o.id}`)}
                        className="group cursor-pointer border-b border-line last:border-0 transition-colors hover:bg-sea-wash/50"
                      >
                        <td className="py-3 pl-5 pr-3">
                          <Link href={`/o/${o.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                            <Monogram name={o.company} size={34} />
                            <span className="grid min-w-0">
                              <span className="flex items-center gap-2 font-semibold text-ink group-hover:text-sea-deep">
                                <span className="truncate">{o.company}</span>
                                {o.example && <Chip size="sm">Example</Chip>}
                              </span>
                              <span className="truncate text-[12.5px] text-ink-3">{o.role || 'No role'}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <div className="grid gap-1.5">
                            <StepPill o={o} />
                            <Segments o={o} />
                          </div>
                        </td>
                        <td className="px-3 py-3 text-ink-2">{nextAction(o)}</td>
                        <td className="px-3 py-3 text-ink-2">{relativeDay(lastTouch(o))}</td>
                        <td className="px-3 py-3">
                          {replies(o) ? <Chip tone="pos">{replies(o)}</Chip> : <span className="text-ink-3">0</span>}
                        </td>
                        <td className="px-3 py-3 tabular-nums text-ink-2">{daysActive(o)}</td>
                        <td className="pr-3">
                          <RowMenu o={o} onRemove={() => setDropping(o)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* phone list */}
                <ul className="divide-y divide-line md:hidden">
                  {rows.map((o) => (
                    <li key={o.id} className="flex items-center gap-3 px-4 py-3">
                      <Link href={`/o/${o.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <Monogram name={o.company} size={36} />
                        <span className="grid min-w-0 gap-1">
                          <span className="truncate font-semibold">{o.company}</span>
                          <span className="flex items-center gap-2">
                            <StepPill o={o} />
                          </span>
                          <span className="truncate text-[12.5px] text-ink-3">{nextAction(o)}</span>
                        </span>
                      </Link>
                      <RowMenu o={o} onRemove={() => setDropping(o)} />
                    </li>
                  ))}
                </ul>
                {!rows.length && <p className="px-5 py-10 text-center text-ink-3">No matches</p>}
              </div>
            ) : (
              <div className="grid gap-3 overflow-x-auto pb-2 md:grid-cols-6" role="list">
                {PHASE_LIST.map((p) => {
                  const here = rows.filter((o) => currentPhase(o) === p.key);
                  return (
                    <section key={p.key} className="min-w-0 rounded-[14px] bg-sunk p-2" aria-label={p.label}>
                      <header className="flex items-center gap-2 px-2 pb-2 pt-1.5">
                        <span className="grid size-6 place-items-center rounded-full bg-panel text-sea shadow-e1">
                          <PhaseIcon phase={p.key} className="size-3.5" />
                        </span>
                        <b className="text-[13px]">{p.label}</b>
                        <span className="ml-auto text-[11.5px] font-semibold text-ink-3">{here.length}</span>
                      </header>
                      <div className="grid gap-2">
                        {here.map((o) => (
                          <div key={o.id} className="group relative rounded-[12px] border border-line bg-panel p-3 shadow-e2 transition hover:-translate-y-0.5 hover:shadow-e3">
                            <Link href={`/o/${o.id}`} className="flex items-center gap-2.5 pr-6">
                              <Monogram name={o.company} size={30} />
                              <span className="grid min-w-0">
                                <b className="truncate text-[13.5px] group-hover:text-sea-deep">{o.company}</b>
                                <span className="truncate text-[11.5px] text-ink-3">{o.role}</span>
                              </span>
                            </Link>
                            <div className="absolute right-1.5 top-1.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                              <RowMenu o={o} onRemove={() => setDropping(o)} />
                            </div>
                            <div className="mt-3 grid gap-2">
                              <Segments o={o} />
                              <span className="text-[12px] text-ink-2">{nextAction(o)}</span>
                            </div>
                          </div>
                        ))}
                        {!here.length && <div className="h-16 rounded-[12px] border border-dashed border-line-2" />}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      <Confirm
        open={!!dropping}
        onOpenChange={(o) => !o && setDropping(null)}
        title={dropping ? `Remove ${dropping.company}?` : ''}
        body="Its people, messages, stories and research go with it."
        confirm="Remove"
        onConfirm={() => {
          if (!dropping) return;
          removeOpportunity(dropping.id);
          toast(`${dropping.company} removed`);
          setDropping(null);
        }}
      />
    </>
  );
}
