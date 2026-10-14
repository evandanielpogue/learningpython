'use client';

import { Check } from 'lucide-react';
import type { Proof } from '@/lib/types';
import { cn } from '@/lib/utils';

/* The proof a company is pitched with. Three are suggested; any number can
   be picked. */
export function ProofPicker({
  proof,
  chosen,
  suggested,
  onToggle,
}: {
  proof: Proof[];
  chosen: string[];
  suggested: string[];
  onToggle: (id: string) => void;
}) {
  if (!proof.length) return <p className="text-[13.5px] text-ink-3">No proof on the résumé yet</p>;
  const order = [...suggested, ...proof.map((p) => p.id).filter((id) => !suggested.includes(id))];
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {order.map((id) => {
        const p = proof.find((x) => x.id === id);
        if (!p) return null;
        const on = chosen.includes(id);
        return (
          <li key={id}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(id)}
              className={cn(
                'group flex h-full w-full items-start gap-3 rounded-[12px] border p-3 text-left transition active:scale-[.99]',
                on ? 'border-sea bg-sea-wash shadow-[0_0_0_1px_var(--sea)]' : 'border-line bg-panel hover:border-line-3',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 grid size-5 shrink-0 place-items-center rounded-[6px] border transition',
                  on ? 'scale-105 border-sea bg-sea text-white' : 'border-line-3 bg-panel text-transparent',
                )}
              >
                <Check className="size-3.5" strokeWidth={3} />
              </span>
              <span className="grid min-w-0 gap-1">
                <span className="flex items-center gap-2">
                  <b className="font-mono text-[13px] text-sea">{p.metric}</b>
                  {suggested.includes(id) && <span className="rounded-full bg-sand-wash px-2 py-0.5 text-[11px] font-medium text-sand-ink">Suggested</span>}
                </span>
                <span className="text-[13.5px] leading-snug text-ink">{p.text}</span>
                {p.where && <span className="text-[12px] text-ink-3">{p.where}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
