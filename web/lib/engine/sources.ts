/* ==========================================================================
   Where the prep material comes from.

   Three honest categories, because they behave differently:

     open    the page is public and a model can read it, so we can offer to
             fetch it when Claude is on.
     login   the page is behind a login and its terms do not allow automated
             collection. Glassdoor and Blind are the obvious ones. We send
             you there with the search already built and take a paste back.
     manual  no stable URL worth guessing; you go and look.

   Each entry knows how to build its own search URL from a company name.
   ========================================================================== */

export type SourceAccess = 'open' | 'login' | 'manual';
export type PasteMode = 'questions' | 'notes' | 'customers';

export interface Source {
  id: string;
  group: string;
  name: string;
  access: SourceAccess;
  good: string;
  url: (company: string, role?: string) => string;
  paste: PasteMode;
}

export interface SourceGroup {
  name: string;
  items: Source[];
}

/** A pasted line, turned into a research finding (before it gets an id). */
export interface ParsedFinding {
  kind: string;
  title: string;
  source: string;
  use: string;
}

const q = encodeURIComponent;

export const CATALOGUE: Source[] = [
  /* ---- what they ask in interviews ---- */
  {
    id: 'gd-int', group: 'Interviews', name: 'Glassdoor interviews', access: 'login',
    good: 'Questions candidates say they were actually asked, by role.',
    url: (co, role) => 'https://www.glassdoor.com/Search/results.htm?keyword=' + q(co + ' ' + (role || '') + ' interview'),
    paste: 'questions',
  },
  {
    id: 'blind', group: 'Interviews', access: 'login',
    name: 'Blind', good: 'What employees say anonymously. Blunt, and often current.',
    url: (co) => 'https://www.teamblind.com/search/' + q(co),
    paste: 'notes',
  },
  {
    id: 'reddit', group: 'Interviews', access: 'open',
    name: 'Reddit', good: 'r/sales and the industry subs on this company and its process.',
    url: (co) => 'https://www.reddit.com/search/?q=' + q(co + ' interview'),
    paste: 'questions',
  },

  /* ---- what it is like inside ---- */
  {
    id: 'gd-rev', group: 'Inside', access: 'login',
    name: 'Glassdoor reviews', good: 'Ratings and the written reviews, including the recent trend.',
    url: (co) => 'https://www.glassdoor.com/Search/results.htm?keyword=' + q(co),
    paste: 'notes',
  },
  {
    id: 'indeed', group: 'Inside', access: 'login',
    name: 'Indeed reviews', good: 'A different population than Glassdoor. Worth the second read.',
    url: (co) => 'https://www.indeed.com/cmp/' + q(String(co).replace(/\s+/g, '-')) + '/reviews',
    paste: 'notes',
  },
  {
    id: 'levels', group: 'Inside', access: 'open',
    name: 'Levels.fyi', good: 'What the band actually pays, so you are not guessing in the call.',
    url: (co) => 'https://www.levels.fyi/companies/' + q(String(co).toLowerCase().replace(/\s+/g, '-')) + '/salaries',
    paste: 'notes',
  },

  /* ---- what their customers say: the best material for a sales seat ---- */
  {
    id: 'g2', group: 'Customers', access: 'open',
    name: 'G2', good: 'Customer reviews. The complaints are your discovery questions.',
    url: (co) => 'https://www.g2.com/search?query=' + q(co),
    paste: 'customers',
  },
  {
    id: 'capterra', group: 'Customers', access: 'open',
    name: 'Capterra', good: 'Skews smaller buyers. Good if the role is SMB or mid-market.',
    url: (co) => 'https://www.capterra.com/search/?query=' + q(co),
    paste: 'customers',
  },
  {
    id: 'trustradius', group: 'Customers', access: 'open',
    name: 'TrustRadius', good: 'Longer reviews, usually from people who actually run the tool.',
    url: (co) => 'https://www.trustradius.com/search?q=' + q(co),
    paste: 'customers',
  },

  /* ---- what the company says about itself ---- */
  {
    id: 'news', group: 'The company', access: 'open',
    name: 'Their newsroom', good: 'Launches, funding, leadership changes — in their own words.',
    url: (co) => 'https://news.google.com/search?q=' + q(co),
    paste: 'notes',
  },
  {
    id: 'careers', group: 'The company', access: 'open',
    name: 'The rest of the reqs', good: 'What else they are hiring tells you where the money is going.',
    url: (co, role) => 'https://www.google.com/search?q=' + q(co + ' careers ' + (role || '')),
    paste: 'notes',
  },
];

export function all(): Source[] {
  return CATALOGUE.slice();
}

export function groups(): SourceGroup[] {
  const seen: string[] = [];
  const out: SourceGroup[] = [];
  CATALOGUE.forEach((s) => {
    if (seen.includes(s.group)) return;
    seen.push(s.group);
    out.push({ name: s.group, items: CATALOGUE.filter((x) => x.group === s.group) });
  });
  return out;
}

export function get(id: string): Source | null {
  return CATALOGUE.find((s) => s.id === id) || null;
}

export function linkFor(id: string, company?: string, role?: string): string {
  const s = get(id);
  return s ? s.url(company || '', role || '') : '';
}

/** Sites a model must not be pointed at: their terms do not allow it and the
    page needs a login anyway, so a fetch returns a wall, not an answer. */
export const noFetch: string[] = [
  'glassdoor.com', 'www.glassdoor.com', 'teamblind.com', 'www.teamblind.com',
  'indeed.com', 'www.indeed.com', 'linkedin.com', 'www.linkedin.com',
];

export function fetchable(url: string): boolean {
  const u = String(url || '').toLowerCase();
  return !noFetch.some((h) => u.indexOf('//' + h + '/') > -1 || u.indexOf('.' + h + '/') > -1);
}

/* ----------------------------------------------------------------- parse --
   People paste a screenful, not a tidy object. Split it into items the way
   a person would read it: one per line or bullet, blank lines ignored, the
   numbering and bullet glyphs stripped, anything too short thrown away. */
export function lines(text: string): string[] {
  return String(text || '')
    .split(/\r?\n+/)
    .map((l) => l.replace(/^\s*(?:[-*•●–]|\d+[.)])\s*/, '').trim())
    .filter((l) => l.length > 8);
}

/** a pasted block of interview questions */
export function parseQuestions(text: string, where?: string): ParsedFinding[] {
  return lines(text)
    .filter((l) => /\?\s*$/.test(l) || /^(tell|walk|describe|give|how|what|why|when|which|explain|talk)\b/i.test(l))
    .map((l) => ({
      kind: 'Interview question',
      title: l.replace(/\s+/g, ' '),
      source: where || 'pasted',
      use: '',
    }));
}

/** a pasted block of customer reviews; a complaint is a discovery question */
const GRIPE = /\b(slow|clunky|expensive|confusing|buggy|support|missing|wish|lacks|hard to|difficult|no way to|limited|disappoint)\b/i;

export function parseReviews(text: string, where?: string): ParsedFinding[] {
  return lines(text).map((l) => ({
    kind: GRIPE.test(l) ? 'Customer gripe' : 'Customer voice',
    title: l.replace(/\s+/g, ' ').slice(0, 160),
    source: where || 'pasted',
    use: '',
  }));
}

/** anything else: keep it as notes, one per line */
export function parseNotes(text: string, where?: string): ParsedFinding[] {
  return lines(text).map((l) => ({
    kind: 'Note',
    title: l.replace(/\s+/g, ' ').slice(0, 160),
    source: where || 'pasted',
    use: '',
  }));
}

export function parse(mode: PasteMode | string, text: string, where?: string): ParsedFinding[] {
  if (mode === 'questions') return parseQuestions(text, where);
  if (mode === 'customers') return parseReviews(text, where);
  return parseNotes(text, where);
}
