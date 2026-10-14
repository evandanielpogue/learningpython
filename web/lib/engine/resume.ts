/* ==========================================================================
   Reading a résumé.

   A real parse of real text, not a fake scan. Everything it cannot find it
   leaves blank rather than inventing.
   ========================================================================== */
import type { ParsedResume, Proof, Role } from '../types';
import { uid } from './ids';

/** The example résumé, for anyone who wants to see it working before handing
    over their own history. */
export const EXAMPLE_RESUME = [
  'Evan Pogue',
  'Chicago, IL | evan@example.com | 312 555 0148',
  '',
  'EXPERIENCE',
  '',
  'Senior AE, Mid-Market - Brightline, Chicago (2023 to now)',
  '- Carried $1.2M and finished at 112% through a seat pricing change',
  '- Rebuilt discovery when cycles went from 30 days to 70',
  '- Held the team together through 40% attrition and still made the year',
  '',
  'Account Executive - Northwind, Chicago (2021 to 2023)',
  '- Grew territory ARR 41% year over year',
  '- Got four new AEs to quota in two quarters',
  '- Top 3 of 38 reps, two years running',
  '',
  'SDR, then AE - Cobalt, remote (2018 to 2021)',
  '- Closed the biggest deal the company had done at $340k',
  '- Built the outbound motion from nothing',
  '',
  'TOOLS',
  'Salesforce, HubSpot, Outreach, Gong, Clay, Sales Navigator, MEDDPICC',
].join('\n');

/** Words worth matching a listing against, per proof point. */
export const TAGS: [RegExp, string[]][] = [
  [/pricing|reprice|packaging|seat/i, ['pricing', 'packaging', 'seat', 'change']],
  [/quota|attainment|\bplan\b|number/i, ['quota', 'attainment', 'number']],
  [/cycle|discovery|process|meddpicc|qualif/i, ['discovery', 'cycle', 'process', 'meddpicc']],
  [/territory|arr|growth|expansion|pipeline/i, ['territory', 'growth', 'arr', 'pipeline']],
  [/ramp|onboard|coach|mentor|train|hire/i, ['ramp', 'coaching', 'onboarding', 'team']],
  [/top \d|rank|president|award|consistent/i, ['performance', 'ranking', 'consistent']],
  [/enterprise|largest|biggest|strategic/i, ['enterprise', 'strategic', 'large']],
  [/outbound|cold|prospect/i, ['outbound', 'prospecting']],
  [/mid[- ]market|smb|commercial/i, ['mid-market', 'smb']],
  [/team|manage|lead|director/i, ['team', 'lead', 'manager']],
];

/** Tools and methodologies recognised anywhere in the text. */
export const TOOLS: string[] = [
  'Salesforce', 'HubSpot', 'Outreach', 'Salesloft', 'Gong', 'Chorus', 'Clay', 'Apollo',
  'ZoomInfo', 'Sales Navigator', 'MEDDPICC', 'MEDDIC', 'Challenger', 'Sandler',
  'Looker', 'Tableau', 'Excel', 'Notion', 'Slack', 'Zendesk', 'Intercom', 'Marketo', 'Pardot',
  'Pipedrive', 'Jira', 'Asana', 'Figma', 'SQL', 'Python',
];

/** What the reader could not find, for the review screen. */
export function missingFrom(p: Pick<ParsedResume, 'name' | 'email' | 'phone' | 'location' | 'roles' | 'proof' | 'stack'>): string[] {
  const missing: string[] = [];
  if (!p.name) missing.push('name');
  if (!p.email) missing.push('email');
  if (!p.phone) missing.push('phone');
  if (!p.location) missing.push('location');
  if (!p.roles.length) missing.push('roles');
  if (!p.proof.length) missing.push('proof');
  if (!p.stack.length) missing.push('tools');
  return missing;
}

const BULLET_CHARS = '-\\u2013\\u2014\\u2022*\\u00b7';
const IS_BULLET = new RegExp('^[' + BULLET_CHARS + ']\\s+');

const METRIC = /\$[\d.,]+\s?[KkMmBb]?|\d+(?:\.\d+)?%|\b\d+(?:\s+\w+)?\s+to\s+\d+\b|\bTop\s?\d+\b|\b\d[\d,]*\s?[KkMmBb]?\b/;
const TIDY = /^(?:and|to|at|of|in|on|through|from|with|by|the|a)\s+|\s+(?:and|to|at|of|in|on|through|from|with|by|the|a)$/gi;

/** Parse résumé text. `source` names where the text came from (a file name or
    "pasted text"); callers record it on the profile they build. `now` is
    only used to turn the earliest start year into years of experience. */
export function parseResume(text: string, source: string = 'pasted text', now: Date = new Date()): ParsedResume {
  void source;
  const raw = String(text || '').replace(/\r/g, '');
  const lines = raw.split('\n').map((l) => l.trim());
  const out: ParsedResume = {
    name: '', email: '', phone: '', location: '', years: 0,
    roles: [], proof: [], stack: [], voice: { traits: [] }, missing: [],
  };

  const isBullet = (l: string) => IS_BULLET.test(l);
  const strip = (l: string) => l.replace(IS_BULLET, '').replace(/[.;]$/, '');
  const isSection = (l: string) =>
    /^[A-Z][A-Z /&]{2,28}$/.test(l) ||
    /^(experience|work experience|employment|skills|tools|education|summary|profile|about)\b/i.test(l);

  const email = raw.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/);
  if (email) out.email = email[0];
  const phone = raw.match(/(?:\+?\d[\d ().-]{8,}\d)/);
  if (phone) out.phone = phone[0].trim();
  const loc = raw.match(/\b([A-Z][a-zA-Z.\- ]{2,20},\s?(?:[A-Z]{2}\b|[A-Z][a-z]+))/);
  if (loc) out.location = loc[1].trim();

  /* the name is the first short line with no digits and no @ in it */
  for (let i = 0; i < lines.length && i < 8; i++) {
    const l = lines[i];
    if (!l || /[@\d]/.test(l) || isSection(l)) continue;
    if (l.split(/\s+/).length <= 4 && l.length <= 48) {
      out.name = l.replace(/[|,].*$/, '').trim();
      break;
    }
  }

  /* roles: a heading followed by bullets */
  let section = '';
  let role: Role | null = null;
  const years: number[] = [];
  const splitTools = (s: string) =>
    s.split(/[,;·|]/).forEach((t) => {
      if (t.trim()) out.stack.push(t.trim());
    });

  lines.forEach((l, idx) => {
    if (!l) return;
    if (isSection(l) && !isBullet(l)) {
      section = l.toLowerCase();
      role = null;
      return;
    }

    if (isBullet(l)) {
      if (role) (role as Role).bullets.push(strip(l));
      else if (/tool|skill/.test(section)) splitTools(strip(l));
      return;
    }

    if (/tool|skill/.test(section)) {
      splitTools(l);
      return;
    }

    const next = lines.slice(idx + 1, idx + 4).filter(Boolean)[0] || '';
    const span = l.match(
      /\(?\b((?:19|20)\d{2})\s*(?:to|-|–|—|until)\s*((?:19|20)\d{2}|now|present|current)\b\)?/i,
    );
    if (!span && !isBullet(next)) return;
    if (l.length > 120) return;

    const head = l.replace(span ? span[0] : '', '').replace(/[()]/g, '').trim();
    const bits = head.split(/\s+[-–—|]\s+|\s+\bat\b\s+/i);
    const made: Role = {
      id: uid('r'),
      title: (bits[0] || head).replace(/[,\s]+$/, ''),
      company: (bits[1] || '').replace(/[,\s]+$/, ''),
      span: span ? span[1] + ' to ' + span[2].toLowerCase() : '',
      on: true,
      bullets: [],
    };
    role = made;
    if (span) years.push(parseInt(span[1], 10));
    out.roles.push(made);
  });
  out.roles = out.roles.filter((r) => r.bullets.length);

  if (years.length) {
    out.years = Math.max(0, Math.min(50, now.getFullYear() - Math.min(...years)));
  }

  /* proof is the bullets with a number in them. The label under the big
     number is the clause that number sits in, with the number taken back
     out, so it stays a sentence instead of a shredded one. */
  const seen = new Set<string>();
  out.roles.forEach((r) => {
    r.bullets.forEach((b) => {
      const mm = b.match(METRIC);
      if (!mm || seen.has(b)) return;
      seen.add(b);
      const hit = mm[0].trim();

      const metric = /\sto\s/i.test(hit) ? hit.replace(/\s+\w+\s+to\s+|\s+to\s+/i, '→') : hit;

      /* the clause holding the number, minus the number */
      const clauses = b.split(/,\s+|\s+and\s+|\s+with\s+/i);
      let at = 0;
      for (let k = 0; k < clauses.length; k++) {
        if (clauses[k].indexOf(hit) > -1) {
          at = k;
          break;
        }
      }
      let label = clauses[at].replace(hit, ' ').replace(/\s{2,}/g, ' ').trim().replace(TIDY, '').trim();
      if (label.split(/\s+/).length < 3 && clauses[at + 1]) {
        label = clauses[at + 1].replace(/\s{2,}/g, ' ').trim().replace(TIDY, '').trim();
      }
      if (label.length > 52) label = label.slice(0, 50).replace(/\s\S*$/, '') + '…';

      let tags: string[] = [];
      TAGS.forEach((t) => {
        if (t[0].test(b)) tags = tags.concat(t[1]);
      });
      const proof: Proof = {
        id: uid('w'),
        text: b,
        where: [r.company, r.span].filter(Boolean).join(', '),
        metric,
        short: label.charAt(0).toLowerCase() + label.slice(1),
        tags,
      };
      out.proof.push(proof);
    });
  });
  out.proof = out.proof.slice(0, 12);

  /* tools: whatever a skills section listed, plus anything we recognise */
  TOOLS.forEach((t) => {
    if (new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(raw)) out.stack.push(t);
  });
  const uniq = new Set<string>();
  out.stack = out.stack
    .filter((t) => {
      const k = t.toLowerCase();
      if (uniq.has(k) || t.length > 24) return false;
      uniq.add(k);
      return true;
    })
    .slice(0, 14);

  /* how they write, read off the bullets rather than guessed at */
  const all: string[] = [];
  out.roles.forEach((r) => all.push(...r.bullets));
  if (all.length) {
    const avg = all.reduce((a, b) => a + b.split(/\s+/).length, 0) / all.length;
    const numeric = all.filter((b) => /\d/.test(b)).length / all.length;
    if (avg < 15) out.voice.traits.push('Short lines');
    if (numeric > 0.5) out.voice.traits.push('Numbers first');
    if (avg >= 15) out.voice.traits.push('Full sentences');
    out.voice.traits.push('One ask');
  }

  out.missing = missingFrom(out);
  return out;
}

/** What a model returns for a résumé. Loose on purpose: it is untrusted. */
export interface ModelResume {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  years?: number | string;
  roles?: { title?: string; company?: string; span?: string; bullets?: string[] }[];
  proof?: { text?: string; metric?: string; short?: string; where?: string; tags?: string[] }[];
  /** the prototype's name for `proof`; still accepted */
  wins?: { text?: string; metric?: string; short?: string; where?: string; tags?: string[] }[];
  tools?: string[];
  voice?: string[];
}

/** The model returns content, not bookkeeping, so the ids are added here. */
export function fromModel(data: ModelResume): ParsedResume {
  const roles: Role[] = (data.roles || [])
    .map((r) => ({
      id: uid('r'),
      title: r.title || '',
      company: r.company || '',
      span: r.span || '',
      on: true,
      bullets: (r.bullets || []).filter(Boolean),
    }))
    .filter((r) => r.title || r.company);
  const proof: Proof[] = (data.proof || data.wins || [])
    .map((w) => ({
      id: uid('w'),
      text: w.text || '',
      metric: w.metric || '',
      short: w.short || '',
      where: w.where || '',
      tags: (w.tags || []).map((t) => String(t).toLowerCase()),
    }))
    .filter((w) => w.metric && w.text)
    .slice(0, 12);
  const out: ParsedResume = {
    name: data.name || '',
    email: data.email || '',
    phone: data.phone || '',
    location: data.location || '',
    years: Math.max(0, Math.min(60, parseInt(String(data.years), 10) || 0)),
    roles,
    proof,
    stack: (data.tools || []).filter(Boolean).slice(0, 14),
    voice: { traits: (data.voice || []).filter(Boolean).slice(0, 4) },
    missing: [],
  };
  out.missing = missingFrom(out);
  return out;
}
