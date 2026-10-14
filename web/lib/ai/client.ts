'use client';

import type {
  AgendaItem,
  CoachTurn,
  InterviewQuestions,
  Opportunity,
  ParsedResume,
  Profile,
  Proof,
  Requirement,
} from '@/lib/types';
import { fromModel, matchLocally, parseResume, questions as localQuestions, turn as localTurn, uid } from '@/lib/engine';
import type { InterviewBrief } from '@/lib/ai/prompts';
import type { CoachOut, MatchOut, PracticeOut, ResumeOut, RewriteOut } from './schemas';

/* Every AI feature has a local fallback. `by` says which one answered, so a
   screen can say in one short line when it was pattern matching. */
export interface Answer<T> {
  value: T;
  by: 'claude' | 'local';
  /** set when the model was on but failed and the fallback answered */
  error?: string;
}

let status: Promise<boolean> | null = null;
export function aiOn(): Promise<boolean> {
  status ??= fetch('/api/ai/status')
    .then((r) => (r.ok ? r.json() : { enabled: false }))
    .then((j: { enabled: boolean }) => Boolean(j.enabled))
    .catch(() => false);
  return status;
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}

async function either<T>(remote: () => Promise<T>, local: () => T): Promise<Answer<T>> {
  if (!(await aiOn())) return { value: local(), by: 'local' };
  try {
    return { value: await remote(), by: 'claude' };
  } catch (e) {
    return { value: local(), by: 'local', error: e instanceof Error ? e.message : 'The model failed.' };
  }
}

/* ---- résumé ------------------------------------------------------------- */

export function readResume(text: string, source: string): Promise<Answer<ParsedResume>> {
  return either(
    async () => {
      const r = await post<ResumeOut>('/api/ai/resume', { text });
      return fromModel(r);
    },
    () => parseResume(text, source),
  );
}

/* ---- listing match ------------------------------------------------------ */

export function matchListing(listing: string, requirementTexts: string[], profile: Profile): Promise<Answer<Requirement[]>> {
  return either(
    async () => {
      const r = await post<MatchOut>('/api/ai/match', {
        listing,
        proof: profile.proof.map((p) => ({ id: p.id, text: p.text, metric: p.metric, where: p.where })),
        roles: profile.roles.filter((x) => x.on).map(({ title, company, span, bullets }) => ({ title, company, span, bullets })),
        requirements: requirementTexts,
      });
      return r.requirements.map((x) => ({ ...x, id: uid('rq') }));
    },
    () => matchLocally(requirementTexts, listing, profile.proof),
  );
}

/* ---- the story coach ---------------------------------------------------- */

export function coachTurn(o: Opportunity, item: AgendaItem, history: CoachTurn[], proof: Proof | null): Promise<Answer<CoachOut>> {
  const local = () => {
    const r = localTurn(item, history, { proof });
    return { bubbles: r.bubbles.filter(Boolean), complete: r.complete, story: r.story || '' };
  };
  /* the opening is always local: it is instant and already specific */
  if (!history.length) return Promise.resolve({ value: local(), by: 'local' });
  return either(
    () => post<CoachOut>('/api/ai/coach', { company: o.company, role: o.role, item: { kind: item.kind, label: item.label }, history }),
    local,
  );
}

/* ---- interview ---------------------------------------------------------- */

export function brief(o: Opportunity, proof: Proof[]): InterviewBrief {
  const byId = new Map(proof.map((p) => [p.id, p]));
  const story = (ref: string) => o.agenda.find((a) => a.ref === ref && a.done)?.text;
  return {
    role: o.role,
    company: o.company,
    location: o.location || undefined,
    match: o.requirements.map((r) => ({
      strength: r.strength,
      text: r.text,
      evidence: r.proofIds.map((id) => byId.get(id)?.text).filter((x): x is string => Boolean(x)),
      answer: story(r.id),
    })),
    proof: o.proofIds.map((id) => byId.get(id)).filter((p): p is Proof => Boolean(p)).map((p) => ({ metric: p.metric, text: p.text, story: story(p.id) })),
    people: o.contacts.map((c) => {
      const t = o.touches.filter((x) => x.contactId === c.id && (x.status === 'sent' || x.status === 'replied'));
      return { name: c.name, label: c.title || c.persona, touches: t.length, replied: t.some((x) => x.status === 'replied'), activity: c.activity.map((a) => a.text).slice(0, 3) };
    }),
    research: o.research.map((r) => ({ title: r.title, detail: r.detail })),
  };
}

export function interviewQuestions(o: Opportunity, proof: Proof[]): Promise<Answer<InterviewQuestions>> {
  return either(
    () => post<InterviewQuestions>('/api/ai/questions', brief(o, proof)),
    () => localQuestions(o, proof),
  );
}

/* A practice answer without a model gets the same checks the coach makes:
   a number, "I" over "we", an ending. */
function localPractice(answer: string): PracticeOut {
  const notes: string[] = [];
  if (!/\d/.test(answer)) notes.push("There's no number in it yet. Put the one that proves it.");
  const we = (answer.match(/\bwe\b/gi) || []).length;
  const i = (answer.match(/\bI\b/g) || []).length;
  if (we > i) notes.push("It's mostly \"we\". Say what you did.");
  if (answer.trim().split(/\s+/).length < 40) notes.push("It's short. Add what happened and how it ended.");
  if (answer.trim().split(/\s+/).length > 220) notes.push("It's long. Cut to the problem, what you did, and the result.");
  return { feedback: notes.length ? notes.join(' ') : 'That works. Say it out loud twice and time it under two minutes.', stronger: '' };
}

export function practice(o: Opportunity, question: string, answer: string, proof: Proof[]): Promise<Answer<PracticeOut>> {
  return either(
    () =>
      post<PracticeOut>('/api/ai/practice', {
        company: o.company,
        role: o.role,
        question,
        answer,
        proof: o.proofIds.map((id) => proof.find((p) => p.id === id)?.text).filter((x): x is string => Boolean(x)),
      }),
    () => localPractice(answer),
  );
}

/* ---- messaging ---------------------------------------------------------- */

/* Without a model, the quick asks still do something honest and mechanical. */
function localRewrite(ask: string, draft: string): RewriteOut {
  const a = ask.toLowerCase();
  let body = draft;
  if (/short/.test(a)) {
    const paras = draft.split(/\n{2,}/);
    body = paras.length > 2 ? [paras[0], paras[paras.length - 1]].join('\n\n') : draft.split(/(?<=[.?!])\s+/).slice(0, 3).join(' ');
  } else if (/formal/.test(a)) {
    body = draft.replace(/\b(don't|can't|won't|I'm|it's|you're|I'd|that's)\b/gi, (m) =>
      ({ "don't": 'do not', "can't": 'cannot', "won't": 'will not', "i'm": 'I am', "it's": 'it is', "you're": 'you are', "i'd": 'I would', "that's": 'that is' })[m.toLowerCase()] ?? m,
    );
  } else if (/sign/.test(a)) {
    body = draft.trimEnd() + '\n\n[Your name]';
  }
  return { subject: '', body };
}

export function rewrite(input: { ask: string; subject: string; draft: string; channel: string; to: string; stories: string[] }): Promise<Answer<RewriteOut>> {
  return either(() => post<RewriteOut>('/api/ai/rewrite', input), () => localRewrite(input.ask, input.draft));
}

/* ---- a posting from its link (model only) ------------------------------- */

export async function fetchPosting(url: string): Promise<string> {
  const r = await post<{ text: string }>('/api/ai/posting', { url });
  return r.text;
}
