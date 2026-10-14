'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowDown, ArrowUp, ArrowUpRight, ChevronDown, Lightbulb, Plus, Search, Trash2, UserPlus, X } from 'lucide-react';
import type { Contact, Persona, Suggestion } from '@/lib/types';
import { PERSONAS, lookupLinkedIn, uid } from '@/lib/engine';
import { useStore } from '@/lib/data/store';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { PersonAvatar, PersonaChip } from '@/components/brand/monogram';
import { celebrate } from '@/components/brand/celebrate';
import { OpenStep } from './step-frame';
import type { StepProps } from './types';
import { cn } from '@/lib/utils';

type Draft = Omit<Contact, 'id' | 'activity' | 'notes' | 'tenure' | 'prev' | 'mutuals'> & { notes: string };

function blankDraft(seed?: Partial<Draft>): Draft {
  return { name: '', title: '', persona: 'Peer', email: '', linkedin: '', ask: '', notes: '', ...seed };
}

function AddPerson({ seed, onAdd, onCancel, existing }: { seed?: Partial<Draft>; onAdd: (d: Draft) => void; onCancel: () => void; existing: Contact[] }) {
  const opportunities = useStore((s) => s.ws.opportunities);
  const known = useMemo(() => opportunities.flatMap((o) => [...o.contacts, ...o.suggested]), [opportunities]);
  const [d, setD] = useState<Draft>(blankDraft(seed));
  const [raw, setRaw] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tried, setTried] = useState(false);

  function find() {
    const res = lookupLinkedIn(raw, existing, known);
    if (!res.ok) {
      setMsg({ ok: false, text: res.reason });
      return;
    }
    const p = res.person;
    setD((x) => ({ ...x, name: p.name, title: p.title || x.title, persona: (p.persona as Persona) || x.persona, email: p.email || x.email, linkedin: p.linkedin, ask: p.ask || x.ask }));
    setMsg({ ok: true, text: res.exact || res.pasted ? `Found ${p.name}` : 'Only the name came from that link. Paste their profile for more.' });
  }

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setD((x) => ({ ...x, [k]: e.target.value }));

  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 rounded-[16px] border border-sea-line bg-sea-wash/40 p-4">
      <div>
        <div className="flex gap-2">
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onPaste={() => setTimeout(() => setMsg(null), 0)}
            rows={1}
            placeholder="LinkedIn link, or paste their profile"
            aria-label="LinkedIn link or profile"
            className="min-h-9 flex-1 bg-panel"
          />
          <Button onClick={find} disabled={!raw.trim()}>
            <Search /> Find
          </Button>
        </div>
        {msg && <p className={cn('mt-1.5 text-[12.5px]', msg.ok ? 'text-pos' : 'text-neg')}>{msg.text}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor="p-name">
          <Input id="p-name" value={d.name} onChange={set('name')} aria-invalid={tried && !d.name.trim()} />
        </Field>
        <Field label="Title" htmlFor="p-title">
          <Input id="p-title" value={d.title} onChange={set('title')} />
        </Field>
        <Field label="Who they are to you" htmlFor="p-persona">
          <Select id="p-persona" value={d.persona} onChange={set('persona')}>
            {PERSONAS.map((p) => (
              <option key={p.key}>{p.key}</option>
            ))}
          </Select>
        </Field>
        <Field label="Email" htmlFor="p-email">
          <Input id="p-email" type="email" value={d.email} onChange={set('email')} />
        </Field>
        <Field label="What you want from them" htmlFor="p-ask" className="sm:col-span-2">
          <Input id="p-ask" value={d.ask} onChange={set('ask')} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            setTried(true);
            if (d.name.trim()) onAdd(d);
          }}
        >
          <UserPlus /> Add
        </Button>
      </div>
    </motion.div>
  );
}

function SeatCard({ s, onAdd, onSkip }: { s: Suggestion; onAdd: () => void; onSkip: () => void }) {
  return (
    <div className="grid content-start gap-3 rounded-[14px] border border-dashed border-line-3 bg-panel p-4">
      <div className="flex items-center gap-3">
        <PersonAvatar name={s.persona} persona={s.persona} size={36} />
        <span className="grid min-w-0">
          <b className="truncate text-[14px]">{s.name}</b>
          <span className="truncate text-[12.5px] text-ink-3">{s.title}</span>
        </span>
      </div>
      <p className="text-[13px] leading-snug text-ink-2">{s.why}</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={onAdd}>
          <Plus /> Add
        </Button>
        <Button size="sm" variant="ghost" onClick={onSkip}>
          Skip
        </Button>
      </div>
    </div>
  );
}

export function PeopleStep({ o, onComplete }: StepProps) {
  const update = useStore((s) => s.updateOpportunity);
  const cheer = useStore((s) => s.cheer);
  const [adding, setAdding] = useState<Partial<Draft> | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [tip, setTip] = useState(true);

  const search = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(`hiring ${o.role} at ${o.company}`)}`;

  function add(d: Draft, fromSeat?: string) {
    const c: Contact = { id: uid('p'), ...d, tenure: '', prev: '', mutuals: 0, activity: [] };
    update(o.id, (x) => ({ ...x, contacts: [...x.contacts, c], suggested: fromSeat ? x.suggested.filter((s) => s.id !== fromSeat) : x.suggested }));
    setAdding(null);
    if (o.contacts.length + 1 === 3 && cheer(`${o.id}:three-people`)) celebrate('Three people to reach');
  }

  function move(id: string, dir: -1 | 1) {
    update(o.id, (x) => {
      const list = x.contacts.slice();
      const i = list.findIndex((c) => c.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return x;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...x, contacts: list };
    });
  }

  function patch(id: string, p: Partial<Contact>) {
    update(o.id, (x) => ({ ...x, contacts: x.contacts.map((c) => (c.id === id ? { ...c, ...p } : c)) }));
  }

  const [seatFor, setSeatFor] = useState<string | undefined>();

  return (
    <OpenStep phase="people" onContinue={onComplete} status={o.contacts.length >= 3 ? `${o.contacts.length} people` : `${o.contacts.length} of 3 people`}>
      <div className="grid gap-6">
        {tip && (
          <div className="flex items-center gap-3 rounded-[14px] bg-sand-wash px-4 py-3">
            <Lightbulb className="size-4 shrink-0 text-sand-ink" />
            <p className="min-w-0 flex-1 text-[13.5px]">
              Search LinkedIn for <code className="rounded-[6px] bg-panel px-1.5 py-0.5 font-mono text-[12px] text-sand-ink">hiring [role] at [company]</code>, filtered to Posts.
            </p>
            <Button asChild size="sm" variant="secondary">
              <a href={search} target="_blank" rel="noopener noreferrer">
                Search <ArrowUpRight />
              </a>
            </Button>
            <button className="rounded-md p-1 text-ink-3 hover:bg-panel hover:text-ink" onClick={() => setTip(false)} aria-label="Dismiss">
              <X className="size-4" />
            </button>
          </div>
        )}

        {o.suggested.length > 0 && (
          <section className="grid gap-3">
            <h3 className="text-[15px] font-semibold">Seats</h3>
            <div className="grid gap-3 md:grid-cols-3">
              {o.suggested.map((s) => (
                <SeatCard
                  key={s.id}
                  s={s}
                  onAdd={() => {
                    setSeatFor(s.id);
                    setAdding({ persona: s.persona, ask: s.ask, title: s.placeholder ? '' : s.title, email: '' });
                  }}
                  onSkip={() => update(o.id, (x) => ({ ...x, suggested: x.suggested.filter((y) => y.id !== s.id) }))}
                />
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[15px] font-semibold">People</h3>
            {!adding && (
              <Button size="sm" onClick={() => { setSeatFor(undefined); setAdding({}); }}>
                <UserPlus /> Add a person
              </Button>
            )}
          </div>

          <AnimatePresence>{adding && <AddPerson seed={adding} existing={o.contacts} onCancel={() => setAdding(null)} onAdd={(d) => add(d, seatFor)} />}</AnimatePresence>

          {o.contacts.length ? (
            <ol className="overflow-hidden rounded-[14px] border border-line">
              {o.contacts.map((c, i) => {
                const isOpen = open === c.id;
                return (
                  <li key={c.id} className="border-b border-line last:border-0">
                    <div className={cn('flex items-center gap-3 px-3 py-2.5 transition-colors', isOpen ? 'bg-sea-wash/50' : 'hover:bg-sunk')}>
                      <span className="w-5 text-center text-[12px] font-semibold text-ink-3">{i + 1}</span>
                      <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setOpen(isOpen ? null : c.id)} aria-expanded={isOpen}>
                        <PersonAvatar name={c.name} persona={c.persona} size={34} />
                        <span className="grid min-w-0">
                          <b className="truncate text-[14px]">{c.name}</b>
                          <span className="truncate text-[12.5px] text-ink-3">{c.title || c.persona}</span>
                        </span>
                      </button>
                      <span className="hidden sm:inline-flex">
                        <PersonaChip persona={c.persona} />
                      </span>
                      <span className="flex">
                        <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => move(c.id, -1)} aria-label={`Move ${c.name} up`}>
                          <ArrowUp />
                        </Button>
                        <Button variant="ghost" size="icon" disabled={i === o.contacts.length - 1} onClick={() => move(c.id, 1)} aria-label={`Move ${c.name} down`}>
                          <ArrowDown />
                        </Button>
                      </span>
                      <ChevronDown className={cn('size-4 text-ink-3 transition-transform', isOpen && 'rotate-180')} />
                    </div>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="grid gap-3 bg-sea-wash/30 px-4 pb-4 pt-2 sm:grid-cols-2">
                            <Field label="Name" htmlFor={`n-${c.id}`}>
                              <Input id={`n-${c.id}`} value={c.name} onChange={(e) => patch(c.id, { name: e.target.value })} />
                            </Field>
                            <Field label="Title" htmlFor={`t-${c.id}`}>
                              <Input id={`t-${c.id}`} value={c.title} onChange={(e) => patch(c.id, { title: e.target.value })} />
                            </Field>
                            <Field label="Who they are to you" htmlFor={`r-${c.id}`}>
                              <Select id={`r-${c.id}`} value={c.persona} onChange={(e) => patch(c.id, { persona: e.target.value as Persona })}>
                                {PERSONAS.map((p) => (
                                  <option key={p.key}>{p.key}</option>
                                ))}
                              </Select>
                            </Field>
                            <Field label="Email" htmlFor={`e-${c.id}`}>
                              <Input id={`e-${c.id}`} value={c.email} onChange={(e) => patch(c.id, { email: e.target.value })} className="font-mono text-[12.5px]" />
                            </Field>
                            <Field label="What you want from them" htmlFor={`a-${c.id}`} className="sm:col-span-2">
                              <Input id={`a-${c.id}`} value={c.ask} onChange={(e) => patch(c.id, { ask: e.target.value })} />
                            </Field>
                            <Field label="Notes" htmlFor={`x-${c.id}`} className="sm:col-span-2">
                              <Textarea id={`x-${c.id}`} value={c.notes} onChange={(e) => patch(c.id, { notes: e.target.value })} rows={3} />
                            </Field>
                            <div className="flex justify-end sm:col-span-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-neg hover:bg-neg-wash hover:text-neg"
                                onClick={() => update(o.id, (x) => ({ ...x, contacts: x.contacts.filter((y) => y.id !== c.id), touches: x.touches.filter((t) => t.contactId !== c.id) }))}
                              >
                                <Trash2 /> Remove
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ol>
          ) : (
            !adding && <p className="rounded-[14px] border border-dashed border-line-2 px-4 py-8 text-center text-[13.5px] text-ink-3">Nobody yet</p>
          )}
        </section>
      </div>
    </OpenStep>
  );
}
