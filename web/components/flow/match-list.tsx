'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import type { Proof, Requirement } from '@/lib/types';
import { cn } from '@/lib/utils';

/* What the listing asks for against the proof that answers it. Each row is
   a summary; opening it shows the whole requirement and the whole line of
   every proof point behind it. */

const DOT: Record<Requirement['strength'], string> = {
  strong: 'bg-pos',
  partial: 'bg-sand-strong',
  none: 'bg-neg',
};

export function MatchList({ requirements, proof, fullText }: { requirements: Requirement[]; proof: Proof[]; fullText?: (r: Requirement) => string }) {
  const [open, setOpen] = useState<string | null>(null);
  const byId = new Map(proof.map((p) => [p.id, p]));
  if (!requirements.length) return <p className="text-[13.5px] text-ink-3">No requirements in this listing</p>;
  return (
    <ul className="grid gap-1.5">
      {requirements.map((r) => {
        const isOpen = open === r.id;
        const ps = r.proofIds.map((id) => byId.get(id)).filter((p): p is Proof => Boolean(p));
        const text = fullText ? fullText(r) : r.text;
        return (
          <li key={r.id} className={cn('rounded-[12px] border transition-colors', isOpen ? 'border-sea-line bg-sea-wash/40' : 'border-transparent hover:bg-sunk')}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : r.id)}
              aria-expanded={isOpen}
              className="grid w-full grid-cols-[10px_minmax(0,1fr)_auto_16px] items-center gap-3 px-3 py-2.5 text-left"
            >
              <span className={cn('size-2.5 rounded-full', DOT[r.strength])} title={r.strength} />
              <span className="min-w-0">
                <span className={cn('block text-[14px] font-medium leading-snug', !isOpen && 'line-clamp-2')}>{text}</span>
                {r.priority === 'must' && <span className="mt-1 inline-flex h-5 items-center rounded-full bg-sea-wash px-2 text-[11px] font-medium text-sea-deep">Must have</span>}
              </span>
              <span className="hidden max-w-[260px] flex-wrap justify-end gap-1 sm:flex">
                {ps.length ? (
                  ps.slice(0, 2).map((p) => (
                    <span key={p.id} className="inline-flex h-6 items-center gap-1 rounded-full bg-sand-wash px-2 text-[12px] text-sand-ink">
                      <b className="font-mono text-[11px]">{p.metric}</b>
                      <span className="max-w-[150px] truncate">{p.short}</span>
                    </span>
                  ))
                ) : (
                  <span className="inline-flex h-6 items-center rounded-full bg-neg-wash px-2.5 text-[12px] font-medium text-neg">Gap</span>
                )}
              </span>
              <ChevronDown className={cn('size-4 text-ink-3 transition-transform', isOpen && 'rotate-180')} />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="grid gap-2 px-3 pb-3 pl-[34px]">
                    {r.note && <p className="text-[13px] text-ink-2">{r.note}</p>}
                    {ps.length ? (
                      ps.map((p) => (
                        <div key={p.id} className="flex gap-3 rounded-[10px] border border-line bg-panel p-3">
                          <b className="w-16 shrink-0 font-mono text-[12.5px] text-sea">{p.metric}</b>
                          <span className="grid gap-0.5">
                            <span className="text-[13.5px]">{p.text}</span>
                            {p.where && <span className="text-[12px] text-ink-3">{p.where}</span>}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[13px] text-neg">Nothing on your résumé answers this yet</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}

export function MatchMeter({ requirements }: { requirements: Requirement[] }) {
  const total = requirements.length || 1;
  const strong = requirements.filter((r) => r.strength === 'strong').length;
  const partial = requirements.filter((r) => r.strength === 'partial').length;
  return (
    <div className="grid gap-1.5">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-sunk-2" aria-label={`${strong + partial} of ${requirements.length} matched`}>
        <span className="h-full origin-left animate-sweep bg-pos" style={{ width: `${(strong / total) * 100}%` }} />
        <span className="h-full origin-left animate-sweep bg-sand-strong" style={{ width: `${(partial / total) * 100}%` }} />
      </div>
      <div className="flex gap-4 text-[12px] text-ink-3">
        <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-pos" />{strong} strong</span>
        <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-sand-strong" />{partial} partial</span>
        <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-neg" />{requirements.length - strong - partial} gaps</span>
      </div>
    </div>
  );
}
