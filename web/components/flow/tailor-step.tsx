'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, Check, SkipForward, Sparkles } from 'lucide-react';
import type { AgendaItem, CoachTurn, Opportunity } from '@/lib/types';
import { answerAgenda, bankable, fullRequirement, rankProof, skipAgenda, turn as localTurn } from '@/lib/engine';
import type { Proof } from '@/lib/types';

/* the coach's first line is always local: instant, and already specific */
function openingTurn(item: AgendaItem, proof: Proof | null): string[] {
  return localTurn(item, [], { proof }).bubbles.filter(Boolean);
}
import { coachTurn } from '@/lib/ai/client';
import { rebuildAgenda } from '@/lib/actions';
import { useStore } from '@/lib/data/store';
import { Button } from '@/components/ui/button';
import { celebrate } from '@/components/brand/celebrate';
import { OpenStep } from './step-frame';
import { MatchList, MatchMeter } from './match-list';
import { ProofPicker } from './proof-picker';
import type { StepProps } from './types';
import { cn } from '@/lib/utils';

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Typing() {
  return (
    <div className="flex w-fit items-center gap-1 rounded-[16px] rounded-bl-[6px] bg-sunk px-3.5 py-3" aria-label="Typing">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 animate-bounce rounded-full bg-ink-3" style={{ animationDelay: `${i * 140}ms` }} />
      ))}
    </div>
  );
}

function Chat({ o, item, onDone }: { o: Opportunity; item: AgendaItem; onDone: (story: string) => void }) {
  const profile = useStore((s) => s.ws.profile);
  const update = useStore((s) => s.updateOpportunity);
  const history: CoachTurn[] = useMemo(() => o.chats[item.id] ?? [], [o.chats, item.id]);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [story, setStory] = useState('');
  const [by, setBy] = useState<'claude' | 'local'>('local');
  const scroller = useRef<HTMLDivElement>(null);
  const proof = item.kind === 'story' ? profile.proof.find((p) => p.id === item.ref) ?? null : null;

  function append(turns: CoachTurn[]) {
    update(o.id, (x) => ({ ...x, chats: { ...x.chats, [item.id]: [...(x.chats[item.id] ?? []), ...turns] } }));
  }

  async function ask(h: CoachTurn[]) {
    setTyping(true);
    const r = await coachTurn(o, item, h, proof);
    setBy(r.by);
    /* bubbles arrive one at a time, like someone typing */
    for (const [i, text] of r.value.bubbles.entries()) {
      if (i) await new Promise((res) => setTimeout(res, 650));
      append([{ role: 'coach', text }]);
    }
    setTyping(false);
    if (r.value.complete && r.value.story) setStory(r.value.story);
  }

  /* first open: the coach starts. Chat is keyed by item, so this runs once
     per item and its state starts fresh. */
  useEffect(() => {
    if (!history.length) append(openingTurn(item, proof).map((text) => ({ role: 'coach' as const, text })));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the item changes
  }, [item.id]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [history.length, typing, story]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || typing) return;
    setDraft('');
    const turn: CoachTurn = { role: 'user', text };
    append([turn]);
    await ask([...history, turn]);
  }

  const canSave = history.some((t) => t.role === 'user');

  return (
    <div className="flex min-h-[420px] flex-col overflow-hidden rounded-[16px] border border-line bg-panel">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', item.kind === 'gap' ? 'bg-neg-wash text-neg' : 'bg-sea-wash text-sea-deep')}>
          {item.kind === 'gap' ? 'Gap' : 'Story'}
        </span>
        <b className="min-w-0 flex-1 truncate text-[13.5px]">{item.label}</b>
        {by === 'claude' && <Sparkles className="size-4 text-sea" aria-label="Claude" />}
      </div>

      <div ref={scroller} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4" aria-live="polite">
        <AnimatePresence initial={false}>
          {history.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25 }}
              className={cn(
                'max-w-[85%] whitespace-pre-wrap px-3.5 py-2.5 text-[14px] leading-relaxed',
                t.role === 'coach' ? 'rounded-[16px] rounded-bl-[6px] bg-sunk text-ink' : 'ml-auto rounded-[16px] rounded-br-[6px] bg-sea-bright text-sea-ink',
              )}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
        {typing && <Typing />}
        {story && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-[14px] border border-sand bg-sand-wash p-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[.08em] text-sand-ink">Story</p>
            <p className="text-[14px] leading-relaxed text-ink">{story}</p>
          </motion.div>
        )}
      </div>

      <form onSubmit={send} className="flex items-end gap-2 border-t border-line p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) void send(e);
          }}
          rows={1}
          placeholder="Answer in your own words"
          aria-label="Your answer"
          className="max-h-40 min-h-10 flex-1 resize-none rounded-[20px] bg-sunk px-4 py-2.5 text-[14px] outline-none placeholder:text-ink-3 focus:bg-panel focus:shadow-[0_0_0_2px_var(--sea-tint)]"
        />
        <Button type="submit" variant="primary" size="icon" className="size-10 rounded-full" disabled={!draft.trim() || typing} aria-label="Send">
          <ArrowUp />
        </Button>
      </form>
      <div className="flex items-center justify-end gap-2 border-t border-line bg-sunk/50 px-3 py-2">
        <Button variant="ghost" size="sm" onClick={() => onDone('')}>
          <SkipForward /> Skip
        </Button>
        <Button size="sm" disabled={!canSave && !story} onClick={() => onDone(story || bankable(history))}>
          <Check /> Save story
        </Button>
      </div>
    </div>
  );
}

export function TailorStep({ o, onComplete }: StepProps) {
  const profile = useStore((s) => s.ws.profile);
  const update = useStore((s) => s.updateOpportunity);
  const cheer = useStore((s) => s.cheer);
  const ranked = useMemo(() => rankProof(profile.proof, o.listing), [profile.proof, o.listing]);
  const suggested = ranked.slice(0, 3).map((r) => r.proof.id);
  const queue = o.agenda;
  const firstOpen = queue.find((a) => !a.done && !a.skipped) ?? queue[0];
  const [active, setActive] = useState<string | undefined>(firstOpen?.id);
  const item = queue.find((a) => a.id === active) ?? firstOpen;
  const told = queue.filter((a) => a.done).length;
  const stories = queue.filter((a) => a.kind === 'story').length;

  function toggleProof(id: string) {
    update(o.id, (x) => rebuildAgenda({ ...x, proofIds: x.proofIds.includes(id) ? x.proofIds.filter((p) => p !== id) : [...x.proofIds, id] }, profile));
  }

  function finish(text: string) {
    if (!item) return;
    update(o.id, (x) => (text.trim() ? answerAgenda(x, item.id, text.trim()) : skipAgenda(x, item.id)));
    if (text.trim() && cheer(`${o.id}:story:${item.id}`) && told === 0) celebrate('First story banked');
    const next = queue.find((a) => a.id !== item.id && !a.done && !a.skipped);
    if (next) setActive(next.id);
  }

  return (
    <OpenStep phase="tailor" onContinue={onComplete} status={`${told} of ${queue.length} told`}>
      <div className="grid gap-8">
        <Section title="Match">
          <MatchMeter requirements={o.requirements} />
          <MatchList requirements={o.requirements} proof={profile.proof} fullText={(r) => fullRequirement(o.listing, r.text)} />
        </Section>

        <Section title="Proof" aside={<span className="text-[12.5px] text-ink-3">{o.proofIds.length} leading</span>}>
          <ProofPicker proof={profile.proof} chosen={o.proofIds} suggested={suggested} onToggle={toggleProof} />
        </Section>

        <Section title="Stories" aside={<span className="text-[12.5px] text-ink-3">{told} of {stories + (queue.length - stories)}</span>}>
          {queue.length ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
              <ol className="grid content-start gap-1.5">
                {queue.map((a) => {
                  const on = item?.id === a.id;
                  return (
                    <li key={a.id}>
                      <button
                        onClick={() => setActive(a.id)}
                        aria-current={on ? 'true' : undefined}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-[12px] border px-3 py-2.5 text-left transition',
                          on ? 'border-sea bg-sea-wash' : 'border-transparent hover:bg-sunk',
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border',
                            a.done ? 'border-sand-strong bg-sand text-sand-ink' : a.skipped ? 'border-line-3 bg-sunk text-ink-3' : 'border-line-3',
                          )}
                        >
                          {a.done && <Check className="size-3" strokeWidth={3} />}
                        </span>
                        <span className="grid min-w-0 gap-0.5">
                          <span className={cn('text-[11px] font-semibold', a.kind === 'gap' ? 'text-neg' : 'text-sea')}>{a.kind === 'gap' ? 'Gap' : 'Story'}</span>
                          <span className={cn('text-[13.5px] leading-snug', a.skipped && 'text-ink-3 line-through')}>{a.label}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              {item && <Chat key={item.id} o={o} item={item} onDone={finish} />}
            </div>
          ) : (
            <p className="text-[13.5px] text-ink-3">Pick proof above to get stories to tell</p>
          )}
        </Section>
      </div>
    </OpenStep>
  );
}
