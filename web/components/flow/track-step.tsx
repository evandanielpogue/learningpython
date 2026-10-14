'use client';

import { CalendarCheck, Flag, MailCheck, MessageSquareReply, Sparkles, Trophy, XCircle, Handshake, CircleDot } from 'lucide-react';
import type { Opportunity, TimelineEvent } from '@/lib/types';
import { useStore } from '@/lib/data/store';
import { PHASE_META, daysActive, replies, sentCount } from '@/lib/journey';
import { nextAction, relativeDay } from '@/lib/next-action';
import { OpenStep } from './step-frame';
import { OUTCOME } from './summaries';
import { celebrate } from '@/components/brand/celebrate';
import { cn } from '@/lib/utils';
import type { StepProps } from './types';

const OUTCOMES: { key: Opportunity['outcome']; icon: typeof Flag }[] = [
  { key: 'open', icon: CircleDot },
  { key: 'offer', icon: Handshake },
  { key: 'hired', icon: Trophy },
  { key: 'closed', icon: XCircle },
];

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-line bg-panel p-4 shadow-e1">
      <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-ink-3">{label}</p>
      <p className="mt-1 text-[24px] font-[680] tabular-nums tracking-[-.03em]">{value}</p>
    </div>
  );
}

function eventText(e: TimelineEvent): { icon: typeof Flag; text: string } {
  switch (e.kind) {
    case 'created':
      return { icon: Sparkles, text: e.text };
    case 'step':
      return { icon: Flag, text: `${PHASE_META[e.text as keyof typeof PHASE_META]?.label ?? e.text} done` };
    case 'sent':
      return { icon: MailCheck, text: e.text };
    case 'reply':
      return { icon: MessageSquareReply, text: e.text };
    case 'booked':
      return { icon: CalendarCheck, text: e.text };
    default:
      return { icon: CircleDot, text: e.text };
  }
}

export function TrackStep({ o, onComplete }: StepProps) {
  const update = useStore((s) => s.updateOpportunity);
  const cheer = useStore((s) => s.cheer);

  function setOutcome(outcome: Opportunity['outcome']) {
    update(o.id, (x) => ({ ...x, outcome, timeline: [...x.timeline, { at: Date.now(), kind: 'outcome', text: OUTCOME[outcome] }] }));
    if ((outcome === 'offer' || outcome === 'hired') && cheer(`${o.id}:${outcome}`)) celebrate(outcome === 'hired' ? 'Hired' : 'Offer in hand');
  }

  const events = o.timeline.slice().reverse();

  return (
    <OpenStep
      phase="track"
      onContinue={o.done.includes('track') ? undefined : onComplete}
      continueLabel="Done"
      status={`Next: ${nextAction(o)}`}
    >
      <div className="grid gap-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Sent" value={sentCount(o)} />
          <Stat label="Replies" value={replies(o)} />
          <Stat label="People" value={o.contacts.length} />
          <Stat label="Days" value={daysActive(o)} />
        </div>

        <div>
          <h3 className="mb-3 text-[15px] font-semibold">Status</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Status">
            {OUTCOMES.map(({ key, icon: Icon }) => {
              const on = o.outcome === key;
              return (
                <button
                  key={key}
                  role="radio"
                  aria-checked={on}
                  onClick={() => setOutcome(key)}
                  className={cn(
                    'flex h-12 items-center gap-2.5 rounded-[12px] border px-3 text-[13.5px] font-medium transition active:scale-[.98]',
                    on
                      ? key === 'hired' || key === 'offer'
                        ? 'border-sand-strong bg-sand-wash text-sand-ink'
                        : 'border-sea bg-sea-wash text-sea-deep'
                      : 'border-line bg-panel text-ink-2 hover:border-line-3',
                  )}
                >
                  <Icon className="size-4" />
                  {OUTCOME[key]}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-[15px] font-semibold">Timeline</h3>
          {events.length ? (
            <ol className="relative grid gap-0 border-l-2 border-sea-tint pl-5">
              {events.map((e, i) => {
                const { icon: Icon, text } = eventText(e);
                return (
                  <li key={i} className="relative py-2">
                    <span className="absolute -left-[31px] top-2 grid size-5 place-items-center rounded-full border-2 border-panel bg-sea-tint text-sea">
                      <Icon className="size-3" />
                    </span>
                    <p className="text-[13.5px]">{text}</p>
                    <p className="text-[12px] text-ink-3">{relativeDay(e.at)}</p>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-[13.5px] text-ink-3">Nothing yet</p>
          )}
        </div>
      </div>
    </OpenStep>
  );
}
