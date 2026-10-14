/* ==========================================================================
   The fourteen days: who to reach, when, and what to say.

   A plan matched against whoever is actually on the list. Anything with
   nobody to send it to is left out. Every function is pure: touches go in,
   new touches come out.
   ========================================================================== */
import type { Channel, Contact, Opportunity, Persona, Profile, Proof, Template, Touch } from '../types';
import { leadProof } from './agenda';
import { slugify, uid } from './ids';

export interface PlanRow {
  day: number;
  channel: Channel;
  persona: Persona | null;
  stage: string | null;
  note: string;
}

export const PLAN: PlanRow[] = [
  { day: 0, channel: 'ATS', persona: null, stage: null, note: 'Apply. You still have to exist in the system.' },
  { day: 0, channel: 'LinkedIn', persona: 'Peer', stage: 'First touch', note: 'Ask about the team, nothing else' },
  { day: 2, channel: 'Email', persona: 'Recruiter', stage: 'First touch', note: 'Name the req, ask one question' },
  { day: 3, channel: 'Email', persona: 'Hiring manager', stage: 'First touch', note: 'Your angle, then the page' },
  { day: 5, channel: 'LinkedIn', persona: 'Shared tie', stage: 'Referral ask', note: 'Ask for the intro, write it for them' },
  { day: 7, channel: 'Reply', persona: 'Peer', stage: 'Referral ask', note: 'Now you can ask for the referral' },
  { day: 8, channel: 'Email', persona: 'Hiring manager', stage: 'Follow up', note: 'Bring something new or do not write' },
  { day: 10, channel: 'Email', persona: 'Skip level', stage: 'Escalation', note: 'Eighty words, business first' },
  { day: 12, channel: 'Call', persona: 'Recruiter', stage: 'Follow up', note: 'Pick up the phone' },
  { day: 14, channel: 'Email', persona: null, stage: 'Breakup', note: 'Say you are stopping, leave the door open' },
];

const DAY_MS = 86400000;

type FillContact = Pick<Contact, 'name' | 'title'> | null | undefined;

/** Placeholders are resolved the moment a template lands in a touch, so
    nobody ever has to look at a curly brace.

    `proof` is the whole proof list; the opportunity's `proofIds` say which
    of it to lead with, and the first one fills `{win}`. `angle` is the
    sentence behind `{angle}` (the prototype kept a list of these on the
    campaign); with none, a line that depends on it is dropped rather than
    left hanging. */
export function fill(
  body: string,
  opportunity: Pick<Opportunity, 'company' | 'role' | 'proofIds'>,
  contact: FillContact,
  profile: Pick<Profile, 'name'>,
  proof: Proof[],
  angle: string = '',
): string {
  const first = contact ? String(contact.name).split(' ')[0] : 'there';
  const wins = leadProof(opportunity, proof);
  const win = wins[0] ? wins[0].text.charAt(0).toLowerCase() + wins[0].text.slice(1) : '';
  const slug = slugify(((profile.name || '').split(' ')[0] || 'me') + '-' + opportunity.company);
  /* an angle that lands mid sentence should not start with a capital */
  const lower = angle ? angle.charAt(0).toLowerCase() + angle.slice(1) : '';
  /* a placeholder that resolves to nothing takes its line with it, rather
     than leaving "Marcus, " sitting on its own */
  let out = String(body);
  if (!angle) {
    out = out.replace(/^.*\{angle\}.*$\n?/gm, (line) => (/\{first\}/.test(line) ? '{first},\n' : ''));
  }
  if (!win) out = out.replace(/^\s*\{win\}\.?\s*$\n?/gm, '');
  return (
    out
      .replace(/, \{angle\}/g, ', ' + lower)
      .replace(/\{first\}/g, first)
      .replace(/\{name\}/g, contact ? contact.name : '')
      .replace(/\{title\}/g, contact ? contact.title : '')
      .replace(/\{company\}/g, opportunity.company)
      .replace(/\{role\}/g, opportunity.role)
      .replace(/\{slug\}/g, slug)
      .replace(/\{angle\}/g, angle)
      /* a win that opens a paragraph keeps its capital */
      .replace(/(^|\n)([ \t]*)\{win\}/g, (_m, br: string, sp: string) => br + sp + (wins[0] ? wins[0].text : ''))
      .replace(/\{win\}/g, win)
      .replace(/\{me\}/g, profile.name)
  );
}

/** An unresolved placeholder in a message is the one thing that must never
    go out: "[one sentence on what that took]" is not a sentence. */
export function unresolved(body: string): string[] {
  return String(body || '').match(/\[[^\]\n]{3,}\]/g) || [];
}

/** Build the plan against whoever is on the list. */
export function buildSequence(
  opportunity: Opportunity,
  templates: Template[],
  profile: Pick<Profile, 'name'>,
  proof: Proof[],
  angle: string = '',
): Touch[] {
  const touches: Touch[] = [];
  const contacts = opportunity.contacts || [];

  PLAN.forEach((row) => {
    let person: Contact | null = null;
    if (row.persona) {
      person = contacts.find((p) => p.persona === row.persona) || null;
      if (!person) return; /* nobody to send it to */
    } else if (row.stage === 'Breakup') {
      person = contacts.find((p) => p.persona === 'Hiring manager') || contacts[0] || null;
    }

    let t: Template | null = null;
    if (row.stage) {
      const pool = templates.filter((x) => x.stage === row.stage);
      t =
        pool.find((x) => x.persona === (row.persona || (person ? person.persona : ''))) ||
        pool.find((x) => x.channel === row.channel) ||
        pool[0] ||
        null;
    }
    const subject =
      row.channel === 'Email'
        ? row.stage === 'Follow up' ? 'one more thing on ' + opportunity.company
          : row.stage === 'Breakup' ? 'closing the loop'
            : row.stage === 'Escalation' ? opportunity.company + ' and the number'
              : 'applied for the ' + opportunity.role
        : '';
    touches.push({
      id: uid('s'),
      day: row.day,
      contactId: person ? person.id : null,
      templateId: t ? t.id : null,
      channel: t ? t.channel : row.channel,
      note: row.note,
      status: 'queued',
      subject,
      body: t ? fill(t.body, opportunity, person, profile, proof, angle) : '',
    });
  });

  return touches;
}

/** The text a touch actually sends. A touch that only points at a template
    gets that template resolved the first time it is read, so the editor
    never shows anyone a curly brace. Returns the text; storing it is the
    caller's business. */
export function bodyFor(
  touch: Touch,
  opportunity: Opportunity,
  templates: Template[],
  profile: Pick<Profile, 'name'>,
  proof: Proof[],
  angle: string = '',
): string {
  if (touch.body && touch.body.trim()) return touch.body;
  const t = templates.find((x) => x.id === touch.templateId);
  if (!t) return '';
  const p = opportunity.contacts.find((x) => x.id === touch.contactId) || null;
  return fill(t.body, opportunity, p, profile, proof, angle);
}

/** Somebody wrote back. The rest of the plan for that person is off: you are
    in a conversation now, not a sequence. Returns the new touches and how
    many were dropped so the screen can say so. */
export function logReply(touches: Touch[], touchId: string): { touches: Touch[]; dropped: number } {
  const s = touches.find((x) => x.id === touchId);
  if (!s) return { touches, dropped: 0 };
  let dropped = 0;
  const next = touches.map((x): Touch => {
    if (x.id === touchId) return { ...x, status: 'replied' };
    if (x.contactId === s.contactId && /^(queued|due)$/.test(x.status)) {
      dropped++;
      return { ...x, status: 'skipped' };
    }
    return x;
  });
  return { touches: next, dropped };
}

/** Whole days since the opportunity was added (never negative). */
export function dayOf(opportunity: Pick<Opportunity, 'createdAt'>, now: number): number {
  return Math.max(0, Math.floor((now - opportunity.createdAt) / DAY_MS));
}

/** A touch is due when its day has come, and the day is counted from the day
    the company was added. Returns the same object when nothing changed. */
export function refreshDue(opportunity: Opportunity, now: number): Opportunity {
  if (!opportunity.createdAt) return opportunity;
  const today = dayOf(opportunity, now);
  let changed = false;
  const touches = opportunity.touches.map((x): Touch => {
    if (x.status === 'queued' && x.day <= today) {
      changed = true;
      return { ...x, status: 'due' };
    }
    return x;
  });
  return changed ? { ...opportunity, touches } : opportunity;
}

/** sent and replied are derived from the touches, never counted by hand:
    two counters that can drift is two versions of the truth */
export function counts(touches: Touch[]): { sent: number; replies: number } {
  return {
    sent: touches.filter((x) => x.status === 'sent' || x.status === 'replied').length,
    replies: touches.filter((x) => x.status === 'replied').length,
  };
}

/** What you would normally send to this kind of person at this point: the
    templates, best fit first (persona counts double, channel once). */
export function templatesFor(templates: Template[], persona: Persona | string, channel: Channel | string): Template[] {
  const score = (t: Template) => (t.persona === persona ? 2 : 0) + (t.channel === channel ? 1 : 0);
  return templates.slice().sort((a, b) => score(b) - score(a));
}
