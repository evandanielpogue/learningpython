'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, CalendarCheck, ChevronDown, ClipboardPaste, Loader2, Mic, Plus, Printer, RefreshCw, Trash2 } from 'lucide-react';
import type { Finding, LikelyQuestion, Opportunity, Practice, Profile } from '@/lib/types';
import { questions as localQuestions, sources, uid } from '@/lib/engine';
import { aiOn, interviewQuestions, practice as practiceAnswer } from '@/lib/ai/client';
import { useStore } from '@/lib/data/store';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { celebrate } from '@/components/brand/celebrate';
import { Headshot } from '@/components/brand/headshot';
import { toast } from '@/components/ui/toaster';
import { OpenStep } from './step-frame';
import type { StepProps } from './types';
import { cn } from '@/lib/utils';

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function QuestionCard({ q, practised, onPractice }: { q: LikelyQuestion; practised: boolean; onPractice: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={cn('rounded-[14px] border bg-panel transition', open ? 'border-sea-line shadow-e2' : 'border-line hover:border-line-3')}>
      <button className="flex w-full items-start gap-3 p-4 text-left" onClick={() => setOpen((x) => !x)} aria-expanded={open}>
        <span className={cn('mt-0.5 grid size-6 shrink-0 place-items-center rounded-full', practised ? 'bg-sand text-sand-ink' : 'bg-sea-wash text-sea')}>
          <Mic className="size-3.5" />
        </span>
        <span className="grid min-w-0 flex-1 gap-1">
          <b className="text-[14.5px] leading-snug">{q.question}</b>
          <span className="text-[12.5px] text-ink-3">{q.why}</span>
        </span>
        <ChevronDown className={cn('mt-1 size-4 shrink-0 text-ink-3 transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="grid gap-2 px-4 pb-4 pl-[52px]">
              {q.answer && <p className="rounded-[10px] bg-sea-wash/60 p-3 text-[13.5px] leading-relaxed">{q.answer}</p>}
              {q.gap && <p className="rounded-[10px] bg-warn-wash p-3 text-[13px] text-warn">{q.gap}</p>}
              <div>
                <Button size="sm" onClick={onPractice}>
                  <Mic /> Practice
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function PracticePanel({ o, question, onClose }: { o: Opportunity; question: string; onClose: () => void }) {
  const proof = useStore((s) => s.ws.profile.proof);
  const update = useStore((s) => s.updateOpportunity);
  const cheer = useStore((s) => s.cheer);
  const prior = o.practice.find((p) => p.question === question);
  const [answer, setAnswer] = useState(prior?.answer ?? '');
  const [result, setResult] = useState<{ feedback: string; stronger: string } | null>(prior ? { feedback: prior.feedback, stronger: '' } : null);
  const [busy, setBusy] = useState(false);

  async function check() {
    if (!answer.trim()) return;
    setBusy(true);
    const r = await practiceAnswer(o, question, answer, proof);
    setBusy(false);
    setResult(r.value);
    const entry: Practice = { question, answer, feedback: r.value.feedback };
    update(o.id, (x) => ({ ...x, practice: [...x.practice.filter((p) => p.question !== question), entry] }));
    if (cheer(`${o.id}:first-practice`)) celebrate('First answer practised');
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-3 rounded-[16px] border border-sea-line bg-sea-wash/40 p-4">
      <div className="flex items-start gap-3">
        <Mic className="mt-0.5 size-4 shrink-0 text-sea" />
        <b className="flex-1 text-[14.5px]">{question}</b>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>
      <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Say it the way you would in the room" aria-label="Your answer" className="min-h-32 bg-panel" />
      <div className="flex justify-end">
        <Button variant="night" onClick={check} disabled={!answer.trim() || busy}>
          {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Get feedback
        </Button>
      </div>
      {result && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-2">
          <p className="rounded-[12px] bg-panel p-3 text-[13.5px] leading-relaxed">{result.feedback}</p>
          {result.stronger && (
            <div className="rounded-[12px] border border-sand bg-sand-wash p-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[.08em] text-sand-ink">Stronger</p>
              <p className="text-[13.5px] leading-relaxed">{result.stronger}</p>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

function Research({ o }: { o: Opportunity }) {
  const update = useStore((s) => s.updateOpportunity);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [pasteFrom, setPasteFrom] = useState('');
  const [paste, setPaste] = useState('');
  const groups = sources.groups();

  function add(f: Omit<Finding, 'id'>[]) {
    update(o.id, (x) => ({ ...x, research: [...f.map((y) => ({ ...y, id: uid('f') })), ...x.research] }));
  }

  return (
    <div className="grid gap-4">
      {o.research.length > 0 && (
        <ul className="grid gap-2">
          {o.research.map((r) => (
            <li key={r.id} className="group flex items-start gap-3 rounded-[12px] border border-line bg-panel p-3">
              <span className="mt-0.5 rounded-full bg-sea-wash px-2 py-0.5 text-[11px] font-medium text-sea-deep">{r.kind}</span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <b className="text-[13.5px]">{r.title}</b>
                {r.detail && <span className="text-[13px] text-ink-2">{r.detail}</span>}
                <span className="text-[12px] text-ink-3">{[r.source, r.date].filter(Boolean).join(' · ')}</span>
              </span>
              <button
                className="rounded-md p-1 text-ink-3 opacity-0 transition hover:bg-neg-wash hover:text-neg group-hover:opacity-100 focus:opacity-100"
                onClick={() => update(o.id, (x) => ({ ...x, research: x.research.filter((y) => y.id !== r.id) }))}
                aria-label={`Remove ${r.title}`}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="grid gap-3 rounded-[14px] border border-sea-line bg-sea-wash/40 p-4">
          <Field label="What you found" htmlFor="r-title">
            <Input id="r-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Detail" htmlFor="r-detail">
            <Textarea id="r-detail" value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} className="bg-panel" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button
              variant="night"
              disabled={!title.trim()}
              onClick={() => {
                add([{ date: 'Today', kind: 'Note', title: title.trim(), detail: detail.trim(), source: 'You', use: '' }]);
                setTitle('');
                setDetail('');
                setAdding(false);
              }}
            >
              Add
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" size="sm" className="w-fit" onClick={() => setAdding(true)}>
          <Plus /> Add a finding
        </Button>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.name} className="rounded-[14px] border border-line p-3">
            <p className="mb-2 text-[12.5px] font-semibold">{g.name}</p>
            <ul className="grid gap-1">
              {g.items.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <a href={s.url(o.company, o.role)} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 flex-1 items-center gap-1 truncate text-[13px] font-medium text-sea hover:text-sea-deep">
                    {s.name} <ArrowUpRight className="size-3.5 shrink-0" />
                  </a>
                  <button className="rounded-md p-1 text-ink-3 hover:bg-sunk hover:text-ink" onClick={() => setPasteFrom(s.id)} aria-label={`Paste from ${s.name}`}>
                    <ClipboardPaste className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {pasteFrom && (
        <div className="grid gap-3 rounded-[14px] border border-sea-line bg-sea-wash/40 p-4">
          <Field label={`Paste from ${sources.get(pasteFrom)?.name ?? 'the page'}`} htmlFor="r-paste">
            <Textarea id="r-paste" value={paste} onChange={(e) => setPaste(e.target.value)} rows={5} className="bg-panel" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPasteFrom('')}>Cancel</Button>
            <Button
              variant="night"
              disabled={!paste.trim()}
              onClick={() => {
                const s = sources.get(pasteFrom);
                const found = sources.parse(s?.paste ?? 'notes', paste, s?.name);
                add(found.map((f) => ({ ...f, date: 'Today', detail: '' })));
                toast(`${found.length} ${found.length === 1 ? 'finding' : 'findings'} added`);
                setPaste('');
                setPasteFrom('');
              }}
            >
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* One page to read before walking in. Hidden on screen, the only thing on
   the paper when printed. */
function BriefSheet({ o, profile }: { o: Opportunity; profile: Profile }) {
  const byId = new Map(profile.proof.map((p) => [p.id, p]));
  return (
    <div className="brief-sheet hidden print:block">
      <div className="mb-6 flex items-center gap-4">
        <Headshot photo={profile.photo} name={profile.name} size={56} />
        <div>
          <h1 className="text-[24px]">{o.company}</h1>
          <p>{[o.role, o.location].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      <h2 className="mb-2 mt-4 text-[16px]">Proof</h2>
      <ul className="mb-4 list-disc pl-5">
        {o.proofIds.map((id) => byId.get(id)).filter(Boolean).map((p) => (
          <li key={p!.id}>
            <b>{p!.metric}</b> {p!.text}
            {o.agenda.find((a) => a.ref === p!.id && a.done)?.text && <p className="italic">{o.agenda.find((a) => a.ref === p!.id)?.text}</p>}
          </li>
        ))}
      </ul>
      <h2 className="mb-2 text-[16px]">Questions</h2>
      <ol className="mb-4 list-decimal pl-5">
        {(o.questions?.likely ?? []).map((q, i) => (
          <li key={i} className="mb-1">
            <b>{q.question}</b> {q.answer && <span>— {q.answer}</span>}
          </li>
        ))}
      </ol>
      <h2 className="mb-2 text-[16px]">People</h2>
      <ul className="mb-4 list-disc pl-5">
        {o.contacts.map((c) => (
          <li key={c.id}>
            {c.name}, {c.title || c.persona}
            {c.notes && ` — ${c.notes}`}
          </li>
        ))}
      </ul>
      <h2 className="mb-2 text-[16px]">Research</h2>
      <ul className="list-disc pl-5">
        {o.research.map((r) => (
          <li key={r.id}>
            <b>{r.title}</b> {r.detail}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function InterviewStep({ o, onComplete }: StepProps) {
  const profile = useStore((s) => s.ws.profile);
  const update = useStore((s) => s.updateOpportunity);
  const cheer = useStore((s) => s.cheer);
  const [model, setModel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [practising, setPractising] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'gaps'>('all');

  useEffect(() => {
    void aiOn().then(setModel);
  }, []);

  /* the questions are never empty: work them out locally the first time */
  useEffect(() => {
    if (!o.questions) update(o.id, (x) => ({ ...x, questions: { ...localQuestions(x, profile.proof), source: 'local' } }));
  }, [o.questions, o.id, profile.proof, update]);

  async function redo() {
    setBusy(true);
    const r = await interviewQuestions(o, profile.proof);
    setBusy(false);
    update(o.id, (x) => ({ ...x, questions: { ...r.value, source: r.by } }));
    if (r.error) toast(`Claude could not (${r.error}). Worked them out locally.`);
  }

  function toggleBooked() {
    const booked = !o.booked;
    update(o.id, (x) => ({ ...x, booked, timeline: booked ? [...x.timeline, { at: Date.now(), kind: 'booked', text: 'Interview booked' }] : x.timeline }));
    if (booked && cheer(`${o.id}:booked`)) celebrate('Interview booked');
  }

  const qs = o.questions?.likely ?? [];
  const shown = filter === 'gaps' ? qs.filter((q) => q.gap) : qs;

  return (
    <OpenStep
      phase="interview"
      onContinue={onComplete}
      status={`${o.booked ? 'Booked' : 'Not booked yet'} · ${o.practice.length} practised`}
      aside={
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => window.print()}>
            <Printer /> Brief
          </Button>
          <Button variant={o.booked ? 'secondary' : 'night'} size="sm" onClick={toggleBooked} aria-pressed={o.booked}>
            <CalendarCheck /> {o.booked ? 'Booked' : 'Mark interview booked'}
          </Button>
        </div>
      }
    >
      <div className="grid gap-8">
        <Section
          title="Questions"
          aside={
            <div className="flex items-center gap-2">
              <Select value={filter} onChange={(e) => setFilter(e.target.value as 'all' | 'gaps')} aria-label="Show" className="h-8 w-auto text-[12.5px]">
                <option value="all">All {qs.length}</option>
                <option value="gaps">Gaps {qs.filter((q) => q.gap).length}</option>
              </Select>
              <Button size="sm" variant="secondary" onClick={redo} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} {model ? 'Redo with Claude' : 'Redo'}
              </Button>
            </div>
          }
        >
          {practising && <PracticePanel key={practising} o={o} question={practising} onClose={() => setPractising(null)} />}
          <ul className="grid gap-2">
            {shown.map((q, i) => (
              <QuestionCard key={`${q.question}-${i}`} q={q} practised={o.practice.some((p) => p.question === q.question)} onPractice={() => setPractising(q.question)} />
            ))}
          </ul>
          {(o.questions?.toAsk.length ?? 0) > 0 && (
            <div className="rounded-[14px] bg-sunk p-4">
              <p className="mb-2 text-[13px] font-semibold">Ask them</p>
              <ul className="grid gap-2">
                {o.questions!.toAsk.map((q, i) => (
                  <li key={i} className="text-[13.5px]">
                    <b>{q.question}</b> <span className="text-ink-3">{q.why}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        <Section title="Research">
          <Research o={o} />
        </Section>
      </div>
      <BriefSheet o={o} profile={profile} />
    </OpenStep>
  );
}
