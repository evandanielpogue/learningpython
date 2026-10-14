/* ==========================================================================
   People: who to write to, and reading them off a pasted profile.
   ========================================================================== */
import type { Activity, Contact, Persona, ProfileRead, Suggestion } from '../types';
import { slugify, uid } from './ids';

/** The key the UI maps to a colour token (`--p-peer` and so on). */
export type PersonaKey = 'peer' | 'recruiter' | 'manager' | 'exec' | 'tie' | 'other';

export const PERSONAS: { key: Persona; colour: PersonaKey }[] = [
  { key: 'Peer', colour: 'peer' },
  { key: 'Recruiter', colour: 'recruiter' },
  { key: 'Hiring manager', colour: 'manager' },
  { key: 'Skip level', colour: 'exec' },
  { key: 'Shared tie', colour: 'tie' },
  { key: 'Other', colour: 'other' },
];

/** The colour key for a persona; unknown personas fall back to `other`. */
export function colourFor(persona: string): PersonaKey {
  const p = PERSONAS.find((x) => x.key === persona);
  return p ? p.colour : 'other';
}

/** The three names worth finding on any listing. They are seats, not people:
    each is marked `placeholder` until it has a real name. */
export function suggestFor(company: string, role: string): Suggestion[] {
  const dom = slugify(company).replace(/-/g, '') + '.com';
  const seg = /mid[- ]market/i.test(role || '') ? 'Mid-Market' : /enterprise/i.test(role || '') ? 'Enterprise' : 'Sales';
  return [
    {
      id: uid('g'), placeholder: true, name: 'Director, ' + seg, title: 'Likely hiring manager at ' + company,
      persona: 'Hiring manager',
      found: 'Not found yet — this is the seat, not the person', guessedEmail: true,
      why: 'Owns the number this role carries. The one person who can skip the queue.',
      email: 'first.last@' + dom, linkedin: '', mutuals: 0, tenure: '', prev: '', ask: 'Fifteen minutes',
    },
    {
      id: uid('g'), placeholder: true, name: 'Talent Partner', title: 'Recruiter on this req at ' + company,
      persona: 'Recruiter',
      found: 'Not found yet — this is the seat, not the person', guessedEmail: true,
      why: 'Knows whether the req is moving or already has a finalist.',
      email: 'talent@' + dom, linkedin: '', mutuals: 0, tenure: '', prev: '', ask: 'Whether the req is moving',
    },
    {
      id: uid('g'), placeholder: true, name: 'Someone you already know', title: 'Worked with you, now near ' + company,
      persona: 'Shared tie',
      found: 'Someone from your own history — you will know who', guessedEmail: false,
      why: 'A warm forward beats a cold email every time. Ask them to paste two lines.',
      email: '', linkedin: '', mutuals: 0, tenure: '', prev: '', ask: 'An introduction',
    },
  ];
}

/* A browser cannot read a LinkedIn profile: the page sits behind a login and
   sends no CORS headers, so nothing here can fetch it. What works is the
   person selecting their profile and pasting it. This reads the name, the
   headline, the company and the URL out of that. */
const NOISE =
  /^(contact info|message|connect|follow|more|pending|\d[\d,]*\+? (connections|followers)|·?\s*(1st|2nd|3rd)\b|he\/him|she\/her|they\/them|open to work|premium|verified)/i;

export function readProfile(raw: string): ProfileRead | null {
  const lines = String(raw || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const CLEAN = lines.filter((l) => !NOISE.test(l) && l.length < 160);
  const urlm = String(raw).match(/linkedin\.com\/in\/([A-Za-z0-9\-_%]+)/i);
  let name = '';
  let title = '';
  let where = '';
  for (let i = 0; i < CLEAN.length; i++) {
    const l = CLEAN[i].replace(/\s*[·|,]\s*(1st|2nd|3rd).*$/i, '').replace(/\s*\(.*?\)\s*$/, '');
    if (/^[A-Z][A-Za-z.'\-]+(?:\s+[A-Z][A-Za-z.'\-]+){1,3}$/.test(l) && !/\d/.test(l)) {
      name = l;
      title = CLEAN[i + 1] || '';
      where = CLEAN[i + 2] || '';
      break;
    }
  }
  if (!name) return null;
  if (/^(at|@)\b/i.test(title)) title = '';
  /* the prototype's /\b(?:at|@)/ could never match "@ Company": \b needs a word character beside it */
  const co = title.match(/(?:\bat|@)\s+([A-Z][A-Za-z0-9&.'\-]*(?:\s+[A-Z][A-Za-z0-9&.'\-]*){0,2})/);
  const persona: Persona = /recruit|talent|people|sourcer/i.test(title)
    ? 'Recruiter'
    : /\b(vp|vice president|chief|cro|ceo|coo|president|founder|svp)\b/i.test(title)
      ? 'Skip level'
      : /\b(director|head of|manager|lead)\b/i.test(title)
        ? 'Hiring manager'
        : 'Peer';
  return {
    name,
    title: title.slice(0, 80),
    company: co ? co[1] : '',
    where: /,/.test(where) && where.length < 40 ? where : '',
    persona,
    linkedin: urlm ? 'in/' + urlm[1].toLowerCase() : '',
  };
}

/** What a lookup fills the new-contact form with. */
export type LookedUpPerson = Pick<
  Contact,
  'name' | 'title' | 'persona' | 'tenure' | 'prev' | 'mutuals' | 'email' | 'linkedin' | 'ask'
> & { activity: Activity[] };

export type LookupResult =
  | { ok: true; exact: boolean; pasted?: boolean; person: LookedUpPerson }
  | { ok: false; reason: string };

/** Look someone up by their profile URL, or read a pasted profile. It resolves
    against everyone already on this opportunity (`existingContacts`) and
    everyone the workspace has ever seen (`knownPeople`); anything else comes
    back as a name and nothing more, which is honest about what a URL alone
    can tell you. */
export function lookupLinkedIn(
  raw: string,
  existingContacts: Pick<Contact, 'name' | 'linkedin'>[],
  knownPeople: (Contact | Suggestion)[],
): LookupResult {
  const s = String(raw || '').trim();
  if (!s) return { ok: false, reason: 'Paste their LinkedIn URL first.' };

  /* more than a URL: a pasted profile */
  if (/\n/.test(s) || (s.length > 80 && !/linkedin\.com/i.test(s))) {
    const pr = readProfile(s);
    if (!pr) return { ok: false, reason: 'Could not find a name in that. Paste from the top of their profile.' };
    const d0 = existingContacts.find((p) => p.name.toLowerCase() === pr.name.toLowerCase());
    if (d0) return { ok: false, reason: d0.name + ' is already on your list.' };
    return {
      ok: true, exact: false, pasted: true,
      person: {
        name: pr.name, title: pr.title, persona: pr.persona, tenure: '', prev: '', mutuals: 0,
        email: '', linkedin: pr.linkedin, ask: '', activity: [],
      },
    };
  }

  const m =
    s.match(/linkedin\.com\/(?:in|pub)\/([A-Za-z0-9\-_%]+)/i) ||
    s.match(/^\/?in\/([A-Za-z0-9\-_%]+)/i) ||
    s.match(/^([A-Za-z0-9\-_]{3,})$/);
  if (!m) return { ok: false, reason: 'That does not look like a LinkedIn profile URL.' };

  let decoded = m[1];
  try {
    decoded = decodeURIComponent(m[1]);
  } catch {
    /* a stray % is not worth failing over */
  }
  /* LinkedIn appends a short hex-ish suffix to some slugs (the prototype's
     class was [0-9a-b], a typo for a-f) */
  const slug = decoded.toLowerCase().replace(/-[0-9a-f]{6,}$/, '');

  /* already on this list? */
  const dupe = existingContacts.find((p) => String(p.linkedin || '').toLowerCase().indexOf(slug) > -1);
  if (dupe) return { ok: false, reason: dupe.name + ' is already on your list.' };

  const hit = knownPeople.find((p) => String(p.linkedin || '').toLowerCase().replace('in/', '') === slug);
  if (hit) {
    return {
      ok: true, exact: true,
      person: {
        name: hit.name, title: hit.title, persona: hit.persona, tenure: hit.tenure,
        prev: hit.prev, mutuals: hit.mutuals, email: hit.email,
        linkedin: 'in/' + slug, ask: hit.ask,
        activity: 'activity' in hit && Array.isArray(hit.activity) ? hit.activity.map((a) => ({ ...a })) : [],
      },
    };
  }

  const name = slug
    .split(/[-_]/)
    .filter((w) => w && !/^\d+$/.test(w))
    .slice(0, 3)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  if (!name) return { ok: false, reason: 'Could not read a name out of that URL.' };
  return {
    ok: true, exact: false,
    person: {
      name, title: '', persona: 'Other', tenure: '', prev: '', mutuals: 0,
      email: '', linkedin: 'in/' + slug, ask: '', activity: [],
    },
  };
}
