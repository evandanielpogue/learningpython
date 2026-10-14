'use client';

import { motion, useReducedMotion } from 'motion/react';
import { FileText } from 'lucide-react';
import { PHASE_LIST } from '@/lib/journey';
import { PhaseIcon } from '@/components/brand/phase-icon';
import type { PhaseKey } from '@/lib/types';

/* The whole journey on one screen. The résumé sits at the start; its lines
   with numbers light up and travel down the path, landing under each step
   as the thing that step is built from. No paragraph explains it: the
   proof chips under each step do. */

const LINES = [
  { w: '78%', proof: '$1.2M' },
  { w: '64%' },
  { w: '86%', proof: '30→70' },
  { w: '58%' },
  { w: '72%', proof: '40%' },
];

/* what the résumé becomes at each step after Upload */
const BECOMES: Partial<Record<PhaseKey, { proof: string; as: string }>> = {
  tailor: { proof: '$1.2M', as: 'Story' },
  people: { proof: '30→70', as: 'Reason' },
  messaging: { proof: '$1.2M', as: 'Opener' },
  interview: { proof: '40%', as: 'Answer' },
};

export function Journey() {
  const reduce = useReducedMotion();
  const d = (i: number) => (reduce ? 0 : 0.35 + i * 0.22);

  return (
    <div className="relative grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-center">
      {/* the résumé */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16, rotate: -4 }}
        animate={{ opacity: 1, y: 0, rotate: -2 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative mx-auto w-[200px] rounded-[14px] border border-line bg-panel p-4 shadow-e3 lg:mx-0"
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-[8px] bg-sea-wash text-sea">
            <FileText className="size-4" />
          </span>
          <b className="text-[13px]">Résumé</b>
        </div>
        <div className="grid gap-2">
          {LINES.map((l, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="h-[7px] rounded-full bg-sunk-2" style={{ width: l.w }} />
              {l.proof && (
                <motion.span
                  initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.25 + i * 0.12, type: 'spring', stiffness: 380, damping: 18 }}
                  className="rounded-full bg-sand px-1.5 py-[1px] font-mono text-[10px] font-medium text-sand-ink"
                >
                  {l.proof}
                </motion.span>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* the path */}
      <div className="relative">
        {/* the shoreline the steps sit on (desktop: across; phone: down) */}
        <svg className="pointer-events-none absolute left-0 right-0 top-[34px] hidden h-6 w-full lg:block" viewBox="0 0 600 24" preserveAspectRatio="none" aria-hidden="true">
          <motion.path
            d="M0 12 C 50 2, 100 22, 150 12 S 250 2, 300 12 S 400 22, 450 12 S 550 2, 600 12"
            fill="none"
            stroke="var(--sea-line)"
            strokeWidth="3"
            strokeDasharray="1 9"
            strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          />
        </svg>
        <span className="absolute bottom-6 left-[27px] top-6 w-[3px] rounded-full bg-[repeating-linear-gradient(to_bottom,var(--sea-line)_0_3px,transparent_3px_11px)] lg:hidden" aria-hidden="true" />

        <ol className="relative grid gap-5 lg:grid-cols-6 lg:gap-2">
          {PHASE_LIST.map((p, i) => {
            const b = BECOMES[p.key];
            return (
              <motion.li
                key={p.key}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: d(i), duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-4 lg:flex-col lg:gap-2.5 lg:text-center"
              >
                <motion.span
                  initial={reduce ? false : { scale: 0.4 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: d(i), type: 'spring', stiffness: 420, damping: 16 }}
                  className={
                    'relative grid size-[58px] shrink-0 place-items-center rounded-[18px] shadow-e3 ' +
                    (i === 0 ? 'bg-sea-bright text-sea-ink' : 'border border-line bg-panel text-sea')
                  }
                >
                  <PhaseIcon phase={p.key} className="size-6" />
                  <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-night text-[10.5px] font-semibold text-night-ink">
                    {p.n}
                  </span>
                </motion.span>
                <span className="grid gap-1.5 lg:justify-items-center">
                  <b className="text-[14.5px] font-semibold tracking-[-.01em]">{p.label}</b>
                  {b && (
                    <motion.span
                      initial={reduce ? false : { opacity: 0, y: -18, scale: 0.7 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: d(i) + 0.45, type: 'spring', stiffness: 300, damping: 18 }}
                      className="inline-flex items-center gap-1 rounded-full border border-sand bg-sand-wash py-0.5 pl-1 pr-2 text-[11.5px] font-medium text-sand-ink"
                    >
                      <span className="rounded-full bg-sand px-1.5 font-mono text-[10px]">{b.proof}</span>
                      {b.as}
                    </motion.span>
                  )}
                </span>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
