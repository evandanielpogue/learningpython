'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Copy, FileInput, Loader2, Mail, MessageSquareReply, Phone, Plus, Send, SkipForward, Sparkles, Wand2, Reply as ReplyIcon, Building2 } from 'lucide-react';
import type { Channel, Touch } from '@/lib/types';
import { bodyFor, buildSequence, fill, logReply, refreshDue, stories, templatesFor, uid, unresolved } from '@/lib/engine';
import { rewrite } from '@/lib/ai/client';
import { useStore } from '@/lib/data/store';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { PersonAvatar } from '@/components/brand/monogram';
import { LinkedInMark } from '@/components/brand/linkedin';
import { celebrate } from '@/components/brand/celebrate';
import { toast } from '@/components/ui/toaster';
import { OpenStep } from './step-frame';
import type { StepProps } from './types';
import { cn } from '@/lib/utils';

const CHANNELS: Channel[] = ['Email', 'LinkedIn', 'Call', 'Reply', 'ATS', 'Text'];
const ICON: Record<Channel, React.ComponentType<{ className?: string }>> = { Email: Mail, LinkedIn: LinkedInMark, Call: Phone, Reply: ReplyIcon, ATS: Building2, Text: MessageSquareReply };
const ASKS = ['Shorter', 'Warmer', 'More formal', 'Sign it'];

const STATUS: Record<Touch['status'], { label: string; tone: 'neutral' | 'sea' | 'pos' | 'sand' }> = {
  queued: { label: 'Queued', tone: 'neutral' },
  due: { label: 'Due', tone: 'sea' },
  sent: { label: 'Sent', tone: 'sand' },
  replied: { label: 'Replied', tone: 'pos' },
  skipped: { label: 'Skipped', tone: 'neutral' },
};

export function MessagingStep({ o, onComplete }: StepProps) {
  const ws = useStore((s) => s.ws);
  const update = useStore((s) => s.updateOpportunity);
  const cheer = useStore((s) => s.cheer);
  const proof = ws.profile.proof;
  const [active, setActive] = useState<string | null>(null);
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState(false);

  /* touches fall due as the days pass */
  useEffect(() => {
    const next = refreshDue(o, Date.now());
    if (next !== o) update(o.id, () => next);
  }, [o, update]);

  const touch = o.touches.find((t) => t.id === active) ?? o.touches.find((t) => t.status === 'due') ?? o.touches.find((t) => t.status === 'queued') ?? o.touches[0];
  const contact = touch ? o.contacts.find((c) => c.id === touch.contactId) ?? null : null;
  const body = touch ? bodyFor(touch, o, ws.templates, ws.profile, proof) : '';
  const holes = useMemo(() => unresolved(body), [body]);
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const sent = o.touches.filter((t) => t.status === 'sent' || t.status === 'replied').length;
  const replies = o.touches.filter((t) => t.status === 'replied').length;

  function build() {
    const touches = buildSequence(o, ws.templates, ws.profile, proof).map((t) => ({ ...t, body: bodyFor(t, o, ws.templates, ws.profile, proof) }));
    update(o.id, (x) => refreshDue({ ...x, touches }, Date.now()));
    setActive(touches[0]?.id ?? null);
  }

  function patch(p: Partial<Touch>) {
    if (!touch) return;
    update(o.id, (x) => ({ ...x, touches: x.touches.map((t) => (t.id === touch.id ? { ...t, ...p } : t)) }));
  }

  function advance() {
    const next = o.touches.find((t) => t.id !== touch?.id && (t.status === 'due' || t.status === 'queued'));
    if (next) setActive(next.id);
  }

  function markSent() {
    if (!touch || holes.length) return;
    update(o.id, (x) => ({
      ...x,
      touches: x.touches.map((t) => (t.id === touch.id ? { ...t, body, status: 'sent', sentAt: Date.now() } : t)),
      timeline: [...x.timeline, { at: Date.now(), kind: 'sent', text: `${touch.channel} to ${contact?.name ?? 'the company'}` }],
    }));
    if (cheer(`${o.id}:first-send`)) celebrate('First message out');
    advance();
  }

  function reply() {
    if (!touch) return;
    const r = logReply(o.touches, touch.id);
    update(o.id, (x) => ({ ...x, touches: r.touches, timeline: [...x.timeline, { at: Date.now(), kind: 'reply', text: `${contact?.name ?? 'They'} replied` }] }));
    if (cheer(`${o.id}:reply:${touch.contactId}`)) celebrate(`${contact?.name?.split(' ')[0] ?? 'They'} wrote back`);
    if (r.dropped) toast(`${r.dropped} later ${r.dropped === 1 ? 'touch' : 'touches'} to ${contact?.name ?? 'them'} skipped`);
  }

  async function runRewrite(what: string) {
    if (!touch || !what.trim()) return;
    setBusy(true);
    const r = await rewrite({ ask: what, subject: touch.subject, draft: body, channel: touch.channel, to: contact?.name ?? '', stories: stories(o).map((s) => s.text) });
    setBusy(false);
    setAsk('');
    patch({ body: r.value.body, ...(r.value.subject ? { subject: r.value.subject } : {}) });
    if (r.error) toast(`Claude could not do that (${r.error}). Changed it locally.`);
  }

  if (!o.touches.length) {
    return (
      <OpenStep phase="messaging" onContinue={onComplete} status="No sequence yet">
        <div className="grid place-items-center gap-4 rounded-[16px] border border-dashed border-line-2 px-4 py-12 text-center">
          <span className="grid size-14 place-items-center rounded-[18px] bg-sea-wash text-sea shadow-e2">
            <Send className="size-6" />
          </span>
          <h3 className="text-[17px]">{o.contacts.length ? 'Fourteen days, planned' : 'Add people first'}</h3>
          <Button variant="night" size="lg" onClick={build}>
            <Sparkles /> Build the sequence
          </Button>
        </div>
      </OpenStep>
    );
  }

  return (
    <OpenStep phase="messaging" onContinue={onComplete} status={`${sent} sent · ${replies} ${replies === 1 ? 'reply' : 'replies'}`}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        {/* the timeline */}
        <ol className="relative grid content-start gap-1.5 before:absolute before:bottom-4 before:left-[23px] before:top-4 before:w-[2px] before:bg-sea-tint">
          {o.touches.map((t) => {
            const c = o.contacts.find((x) => x.id === t.contactId);
            const Icon = ICON[t.channel];
            const on = touch?.id === t.id;
            const st = STATUS[t.status];
            return (
              <li key={t.id}>
                <button
                  onClick={() => setActive(t.id)}
                  aria-current={on ? 'true' : undefined}
                  className={cn('relative flex w-full items-start gap-3 rounded-[12px] border px-2.5 py-2 text-left transition', on ? 'border-sea bg-sea-wash' : 'border-transparent hover:bg-sunk', t.status === 'skipped' && 'opacity-55')}
                >
                  <span className={cn('relative z-10 grid size-7 shrink-0 place-items-center rounded-[9px] border-2 border-panel', t.status === 'sent' || t.status === 'replied' ? 'bg-sand text-sand-ink' : 'bg-sea-tint text-sea-deep')}>
                    <Icon className="size-3.5" />
                  </span>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="flex items-center gap-1.5">
                      <b className="truncate text-[13.5px]">{c?.name ?? 'The company'}</b>
                      <Chip tone={st.tone} size="sm" className="ml-auto shrink-0">{st.label}</Chip>
                    </span>
                    <span className="truncate text-[12px] text-ink-3">Day {t.day} · {t.note}</span>
                  </span>
                </button>
              </li>
            );
          })}
          <li>
            <button
              onClick={() => {
                const last = o.touches[o.touches.length - 1];
                const t: Touch = { id: uid('t'), day: (last?.day ?? 0) + 2, contactId: o.contacts[0]?.id ?? null, templateId: null, channel: 'Email', note: 'New touch', status: 'queued', subject: '', body: '' };
                update(o.id, (x) => ({ ...x, touches: [...x.touches, t] }));
                setActive(t.id);
              }}
              className="flex w-full items-center gap-3 rounded-[12px] border border-dashed border-line-2 px-2.5 py-2 text-[13px] font-medium text-ink-3 hover:border-line-3 hover:text-ink"
            >
              <span className="grid size-7 place-items-center rounded-[9px] bg-sunk">
                <Plus className="size-3.5" />
              </span>
              Add a touch
            </button>
          </li>
        </ol>

        {/* the editor */}
        {touch && (
          <motion.div key={touch.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="grid content-start gap-4 rounded-[16px] border border-line bg-panel p-4 shadow-e1">
            <div className="flex items-center gap-3">
              {contact ? <PersonAvatar name={contact.name} persona={contact.persona} size={38} /> : <span className="grid size-[38px] place-items-center rounded-full bg-sunk text-ink-3"><Building2 className="size-4" /></span>}
              <span className="grid min-w-0 flex-1">
                <b className="truncate text-[15px]">{contact?.name ?? 'The company'}</b>
                <span className="truncate text-[12.5px] text-ink-3">{touch.note}</span>
              </span>
              <Chip tone={STATUS[touch.status].tone}>{STATUS[touch.status].label}</Chip>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_90px]">
              <Field label="To" htmlFor="m-to">
                <Select id="m-to" value={touch.contactId ?? ''} onChange={(e) => patch({ contactId: e.target.value || null })}>
                  <option value="">The company</option>
                  {o.contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Channel" htmlFor="m-ch">
                <Select id="m-ch" value={touch.channel} onChange={(e) => patch({ channel: e.target.value as Channel })}>
                  {CHANNELS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Day" htmlFor="m-day">
                <Input id="m-day" type="number" min={0} max={60} value={touch.day} onChange={(e) => patch({ day: Math.max(0, Number(e.target.value) || 0) })} />
              </Field>
            </div>

            <Field label="Template" htmlFor="m-tpl">
              <Select
                id="m-tpl"
                value={touch.templateId ?? ''}
                onChange={(e) => {
                  const t = ws.templates.find((x) => x.id === e.target.value);
                  patch({ templateId: t?.id ?? null, body: t ? fill(t.body, o, contact, ws.profile, proof) : touch.body });
                }}
              >
                <option value="">None</option>
                {templatesFor(ws.templates, contact?.persona ?? 'Other', touch.channel).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </Field>

            {touch.channel === 'Email' && (
              <Field label="Subject" htmlFor="m-subj">
                <Input id="m-subj" value={touch.subject} onChange={(e) => patch({ subject: e.target.value })} />
              </Field>
            )}

            <Textarea value={body} onChange={(e) => patch({ body: e.target.value })} aria-label="Message" placeholder={touch.channel === 'ATS' ? 'What you submitted' : touch.channel === 'Call' ? 'What you will say' : 'Write the message'} className="min-h-56 font-mono text-[13px] leading-relaxed" />

            <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
              <span className={cn('tabular-nums', words > 130 ? 'text-warn' : 'text-ink-3')}>{words} words</span>
              {holes.map((h) => (
                <span key={h} className="rounded-full bg-warn-wash px-2 py-0.5 text-warn">{h}</span>
              ))}
            </div>

            <div className="grid gap-2 rounded-[12px] bg-sunk/70 p-3">
              <div className="flex flex-wrap gap-1.5">
                {ASKS.map((a) => (
                  <button key={a} disabled={busy} onClick={() => runRewrite(a)} className="h-8 rounded-full border border-line bg-panel px-3 text-[12.5px] font-medium text-ink-2 transition hover:border-sea hover:text-sea-deep disabled:opacity-50">
                    {a}
                  </button>
                ))}
              </div>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void runRewrite(ask); }}>
                <Input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Ask for a change" aria-label="Ask for a change" className="bg-panel" />
                <Button type="submit" disabled={!ask.trim() || busy} aria-label="Rewrite">
                  {busy ? <Loader2 className="animate-spin" /> : <Wand2 />}
                </Button>
              </form>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigator.clipboard?.writeText((touch.subject ? touch.subject + '\n\n' : '') + body).then(() => toast('Copied'))}>
                <Copy /> Copy
              </Button>
              {(touch.status === 'queued' || touch.status === 'due') && (
                <Button variant="ghost" size="sm" onClick={() => { patch({ status: 'skipped' }); advance(); }}>
                  <SkipForward /> Skip
                </Button>
              )}
              <span className="flex-1" />
              {touch.status === 'sent' && (
                <Button onClick={reply}>
                  <MessageSquareReply /> They replied
                </Button>
              )}
              {(touch.status === 'queued' || touch.status === 'due') && (
                <Button variant="night" onClick={markSent} disabled={holes.length > 0} title={holes.length ? 'Fill in the placeholders first' : undefined}>
                  <FileInput /> Mark sent
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </OpenStep>
  );
}
