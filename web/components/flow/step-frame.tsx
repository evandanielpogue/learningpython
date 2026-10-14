'use client';

import { forwardRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Check } from 'lucide-react';
import type { PhaseKey } from '@/lib/types';
import { PHASE_META } from '@/lib/journey';
import { PhaseIcon } from '@/components/brand/phase-icon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/* The three faces of a step on the opportunity page.

   Done      a compact sand card with a one-line summary. Clicking it reopens
             the step; that is the only way back, and it never looks like
             the primary action.
   Open      the step itself, expanded, with one primary button at the foot
             that finishes it and opens the next.
   Upcoming  a quiet row: you can see what is coming, not jump to it. */

const EASE = [0.16, 1, 0.3, 1] as const;

export function StepNumber({ phase, state }: { phase: PhaseKey; state: 'done' | 'open' | 'upcoming' }) {
  return (
    <span
      className={cn(
        'relative grid size-10 shrink-0 place-items-center rounded-[13px] transition-colors',
        state === 'done' && 'bg-sand text-sand-ink',
        state === 'open' && 'bg-sea-bright text-sea-ink shadow-[0_6px_18px_-6px_rgba(56,189,242,.8)]',
        state === 'upcoming' && 'border border-line-2 bg-panel text-ink-3',
      )}
    >
      {state === 'done' ? <Check className="size-5" strokeWidth={2.6} /> : <PhaseIcon phase={phase} className="size-[18px]" />}
    </span>
  );
}

export function DoneCard({ phase, summary, onReopen }: { phase: PhaseKey; summary: React.ReactNode; onReopen: () => void }) {
  return (
    <motion.button
      layout="position"
      type="button"
      onClick={onReopen}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="group flex w-full items-center gap-4 rounded-[14px] border border-sand/70 bg-sand-wash/60 px-4 py-3 text-left transition hover:border-sand-strong hover:bg-sand-wash"
      aria-label={`${PHASE_META[phase].label}, done. Reopen`}
    >
      <StepNumber phase={phase} state="done" />
      <span className="grid min-w-0 flex-1">
        <b className="text-[14.5px] font-semibold">{PHASE_META[phase].label}</b>
        <span className="truncate text-[13px] text-ink-2">{summary}</span>
      </span>
      <span className="text-[12.5px] font-medium text-sand-ink opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">Reopen</span>
    </motion.button>
  );
}

export function UpcomingRow({ phase }: { phase: PhaseKey }) {
  return (
    <motion.div layout="position" className="flex items-center gap-4 rounded-[14px] px-4 py-2.5 opacity-70">
      <StepNumber phase={phase} state="upcoming" />
      <b className="text-[14px] font-medium text-ink-3">{PHASE_META[phase].label}</b>
    </motion.div>
  );
}

export const OpenStep = forwardRef<
  HTMLElement,
  {
    phase: PhaseKey;
    aside?: React.ReactNode;
    children: React.ReactNode;
    /** what finishing this step needs, shown beside the button; never blocks it */
    status?: React.ReactNode;
    continueLabel?: string;
    onContinue?: () => void;
    footer?: React.ReactNode;
  }
>(function OpenStep({ phase, aside, children, status, continueLabel, onContinue, footer }, ref) {
  const reduce = useReducedMotion();
  const meta = PHASE_META[phase];
  return (
    <motion.section
      ref={ref}
      layout="position"
      initial={reduce ? false : { opacity: 0, y: 14, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="relative scroll-mt-24 overflow-hidden rounded-[18px] border border-sea-line bg-panel shadow-e3"
      aria-labelledby={`step-${phase}`}
    >
      <span className="absolute inset-x-0 top-0 h-1 origin-left animate-sweep bg-gradient-to-r from-sea-bright via-sea-glow to-sand" aria-hidden="true" />
      <header className="flex flex-wrap items-center gap-4 px-5 pt-6 md:px-7">
        <StepNumber phase={phase} state="open" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[.09em] text-sea">Step {meta.n}</p>
          <h2 id={`step-${phase}`} className="text-[22px] font-[680] tracking-[-.025em]">
            {meta.label}
          </h2>
        </div>
        {aside}
      </header>

      <AnimatePresence initial={false}>
        <motion.div
          initial={reduce ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.45, ease: EASE }}
          className="px-5 pb-2 pt-5 md:px-7"
        >
          {children}
        </motion.div>
      </AnimatePresence>

      {(onContinue || footer) && (
        <footer className="mt-4 flex flex-wrap items-center gap-3 border-t border-line bg-sunk/50 px-5 py-4 md:px-7">
          {footer}
          <span className="min-w-0 flex-1 text-[13px] text-ink-2">{status}</span>
          {onContinue && (
            <Button variant="primary" size="lg" onClick={onContinue} className="group">
              {continueLabel ?? (meta.next ? `Continue to ${meta.next}` : 'Done')}
              <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
            </Button>
          )}
        </footer>
      )}
    </motion.section>
  );
});
