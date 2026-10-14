/* ==========================================================================
   The story coach: questions worked out rather than listed.

   Two callers. Prep asks it what to say next in a conversation: an opening
   that names the actual number or the actual tool, then a follow-up chosen
   by what is missing from what the person just said. The brief asks it what
   this company is likely to ask, built out of the listing, the résumé, the
   gaps between them, the research and what the people involved said in
   public.

   Nothing here invents a fact. Every question is assembled out of text the
   user already gave us, and where there is nothing to build on the function
   says so instead of producing filler. When a model is configured it takes
   over and this becomes the fallback: same shape, same contract.
   ========================================================================== */
import type {
  AgendaItem, CoachReply, InterviewQuestions, LikelyQuestion, Opportunity, Proof, Requirement,
} from '../types';

/* ---------------------------------------------------------------- read --
   What kind of number is this, and what does that make it worth asking? */
const MONEY = /\$\s?([\d.,]+)\s*([kmb])?/i;
const PCT = /(\d+(?:\.\d+)?)\s?%/;
const SHIFT = /(\d+)\s*(?:->|→|to)\s*(\d+)/;
const MULT = /(\d+(?:\.\d+)?)\s?x\b/i;
const COUNT = /\b(\d{1,4})\b/;

export type WinKind = 'none' | 'shift' | 'money' | 'loss' | 'over' | 'pct' | 'multiple' | 'count';

export interface WinRead {
  kind: WinKind;
  metric: string;
  text: string;
  from?: string;
  to?: string;
  worse?: boolean;
  pct?: number;
}

export function readWin(win: Pick<Proof, 'metric' | 'text'> | null | undefined): WinRead {
  const m = String((win && win.metric) || '');
  const t = String((win && win.text) || '');
  const hay = m + ' ' + t;
  const out: WinRead = { kind: 'none', metric: m, text: t };

  if (SHIFT.test(m)) {
    const s = m.match(SHIFT) as RegExpMatchArray;
    out.kind = 'shift';
    out.from = s[1];
    out.to = s[2];
    out.worse = Number(s[2]) > Number(s[1]);
  } else if (MONEY.test(m)) {
    out.kind = 'money';
  } else if (PCT.test(m)) {
    const p = Number((m.match(PCT) as RegExpMatchArray)[1]);
    out.kind = /attrition|churn|turnover|left|lost/i.test(hay) ? 'loss' : p > 100 ? 'over' : 'pct';
    out.pct = p;
  } else if (MULT.test(m)) {
    out.kind = 'multiple';
  } else if (COUNT.test(m)) {
    out.kind = 'count';
  }
  return out;
}

/* what a listing line is really asking for */
export type ReqCat =
  | 'tool' | 'method' | 'segment' | 'motion' | 'scale' | 'leadership' | 'domain' | 'years' | 'other';

const CATS: [Exclude<ReqCat, 'other'>, RegExp][] = [
  ['tool', /salesforce|hubspot|outreach|salesloft|gong|chorus|clari|looker|tableau|zoominfo|apollo|jira|netsuite|workday|marketo|pardot|sfdc|crm\b/i],
  ['method', /meddpicc|meddic|challenger|spin|sandler|bant|command of the message|force management|value selling|qualification|forecast/i],
  ['segment', /mid[- ]?market|enterprise|smb\b|commercial|strategic account|named account|fortune \d/i],
  ['motion', /outbound|full[- ]?cycle|land and expand|product[- ]?led|plg\b|channel|partner|renewal|expansion|upsell|cross[- ]?sell|inbound/i],
  ['scale', /quota|\$[\d.,]+\s?[kmb]?|arr\b|acv\b|pipeline|book of business|territory/i],
  ['leadership', /mentor|coach|lead a team|manage|player[- ]?coach|ramp|onboard|enable/i],
  ['domain', /healthcare|fintech|security|devops|revops|hr tech|legal|manufactur|logistics|saas|api|data platform/i],
  ['years', /\b\d\+?\s*years?\b/i],
];

export interface ReqRead {
  cat: ReqCat;
  term: string;
  text: string;
}

export function readReq(req: { text?: string } | string | null | undefined): ReqRead {
  const text = String((req && typeof req === 'object' ? req.text : req) || '');
  for (let i = 0; i < CATS.length; i++) {
    if (CATS[i][1].test(text)) {
      const hit = text.match(CATS[i][1]);
      return { cat: CATS[i][0], term: (hit && hit[0]) || '', text };
    }
  }
  return { cat: 'other', term: '', text };
}

/* --------------------------------------------------------------- shape --
   Turn a requirement line into something a person would actually say out
   loud. "Experience with a track record of X" is a listing; "Tell me about
   X" is a question. */
export function bare(text: string): string {
  return String(text)
    .replace(/^(proven |demonstrated |strong |deep |solid )/i, '')
    .replace(
      /^(experience|expertise|background|a track record|track record|familiarity|comfort(?:able)?|ability)\s*(with|in|of|to)?\s*/i,
      '',
    )
    .replace(/^(you|we)('| a)?re\s+/i, '')
    .replace(/[.;]\s*$/, '')
    .trim();
}

/** cut at a word boundary, and never leave a dangling opening quote */
export function clip(text: string, n: number): string {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  let cut = t.slice(0, n);
  const sp = cut.lastIndexOf(' ');
  if (sp > n * 0.5) cut = cut.slice(0, sp);
  const quotes = (cut.match(/"/g) || []).length;
  if (quotes % 2) cut = cut.slice(0, cut.lastIndexOf('"')).replace(/\s+$/, '');
  return cut.replace(/[,;:\s]+$/, '') + '…';
}

/** join a fragment to a following sentence without stacking punctuation:
    a clipped ellipsis is dropped, and a quote that already closes on a full
    stop is left exactly as its author wrote it. */
export function join(stem: string, next: string): string {
  let t = String(stem || '').replace(/[\s.…]+$/, '');
  if (/["'”][.!?]?$/.test(String(stem).trim())) t = String(stem).trim().replace(/…$/, '');
  return t + (/[.!?]["'”]?$/.test(t) ? ' ' : '. ') + next;
}

function lower(t: string): string {
  return t ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

/* Listing lines come in three grammatical shapes and each one needs a
   different question around it, or you get "tell me about your experience
   with work RevOps buyers through an evaluation". */
const VERBS =
  /^(work|run|build|manage|own|drive|close|source|prospect|partner|lead|ramp|help|sell|forecast|negotiate|develop|execute|collaborate|maintain|deliver|create|support|identify|grow|expand|carry|hit|exceed|navigate|qualify|handle|present|demo|coach|mentor|report|track|use)\b/i;
const YEARS = /^(\d+)\+?\s*years?\b/i;

export type ReqShape = 'years' | 'action' | 'thing';

export function shape(text: string): ReqShape {
  const t = bare(text);
  if (YEARS.test(t)) return 'years';
  if (VERBS.test(t)) return 'action';
  return 'thing';
}

/** the line, turned into something a person would say out loud */
export function asQuestion(text: string): string {
  const t = bare(text);
  switch (shape(t)) {
    case 'years': {
      const n = (t.match(YEARS) as RegExpMatchArray)[1];
      return 'You have ' + n + '-odd years in this. Where were they, and which of them look most like this job?';
    }
    case 'action':
      return 'Walk me through how you ' + lower(t) + '.';
    default:
      return 'Tell me about ' + lower(t) + '.';
  }
}

/* ----------------------------------------------------------- variation --
   A conversation that says the same sentence every time reads like a form.
   These pick from a set, seeded on the item and the turn, so the wording
   moves between items and between turns but stays put when the view
   repaints: nothing jumps around under the person mid-sentence. */
export function seed(str: string): number {
  let h = 2166136261;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pick<T>(list: readonly T[] | null | undefined, key: string): T | null {
  if (!list || !list.length) return null;
  return list[seed(key) % list.length];
}

/** Asking the same sentence twice is the single most robotic thing a
    conversation can do, so a line that has already been said is taken out
    of the running. When every variant is spent the caller moves on. */
export function pickUnused<T>(list: readonly T[] | null | undefined, key: string, used?: readonly T[]): T | null {
  if (!list || !list.length) return null;
  const free = list.filter((t) => (used || []).indexOf(t) === -1);
  return free.length ? free[seed(key) % free.length] : null;
}

/* ------------------------------------------------------------- opening --
   The first question on an agenda item. Specific to the number or the
   term; never "tell me about yourself". */
const GAP_OPENERS: Record<ReqCat, string[]> = {
  tool: [
    'They want {term}. Have you used it?',
    '{term} is on the list. What did you use instead?',
    'Have you worked with {term}, or something like it?',
  ],
  method: [
    'They want {term}. Did your team actually run that?',
    '{term}. How did you qualify a deal?',
    'They ask for {term}. What did you use?',
  ],
  segment: [
    "This is a {term} seat. What have you been selling?",
    '{term}. How close is that to your deals?',
    "They want {term}. What's different about yours?",
  ],
  motion: [
    'They want {term}. How much of your pipeline did you source yourself?',
    '{term}. Have you run that, or did it come to you?',
    'Tell me about your {term}. What did the first touch look like?',
  ],
  scale: [
    "What's the biggest number you've carried?",
    "They're describing the quota. What have you carried, and did you hit it?",
    'What was your number, and what did you finish at?',
  ],
  leadership: [
    'Who have you brought up? A name is fine.',
    'Have you done this for anyone? Tell me about them.',
    "Who's the last person you helped get good at this?",
  ],
  domain: [
    "You haven't sold into {term}. Who's the closest?",
    'No {term} on the résumé. Which buyer is most like them?',
    '{term} is new. Who have you sold to that thinks the same way?',
  ],
  years: [
    'They want {term}. What do you have?',
    '{term} is what they wrote. What happened in yours?',
    "You're short on the years. What did you pack into the time you had?",
  ],
  other: [
    "Nothing on your résumé covers this. What's the closest you've got?",
    'This one is uncovered. Where have you come near it?',
    'What would you say if they asked you this cold?',
  ],
};

type WinBucket =
  | 'money' | 'over' | 'loss' | 'shiftWorse' | 'shiftBetter' | 'multiple' | 'plain' | 'none';

const WIN_OPENERS: Record<WinBucket, string[]> = {
  money: [
    '{metric}. What was it before you took it over?',
    'Okay, {metric}. How much of that was new business?',
    'Tell me about the {metric}. Where did it start?',
  ],
  over: [
    '{metric}. What was the number you were chasing?',
    'You hit {metric}. Was that steady, or did one deal carry it?',
    '{metric} of quota. When did you know you had it?',
  ],
  loss: [
    '{metric}. What happened that year?',
    '{metric} is rough. Who left?',
    'Tell me about the {metric}. What was going on?',
  ],
  shiftWorse: [
    '{from} to {to}. What happened?',
    'It went from {from} to {to}. When did you notice?',
    '{from} up to {to}. What was driving that?',
  ],
  shiftBetter: [
    '{from} to {to}. What did you change?',
    'You got it from {from} to {to}. What worked?',
    'From {from} to {to}. How long did that take?',
  ],
  multiple: [
    '{metric} off what?',
    '{metric}. What was the starting point?',
    'Tell me about the {metric}. Over how long?',
  ],
  plain: [
    '{metric}. What was it before?',
    'Tell me about the {metric}. What did you do?',
    'You put {metric} on the résumé. Where did that come from?',
  ],
  none: ['Tell me what happened here.', "What's the story behind this one?", 'Walk me through it.'],
};

function template(tpl: string, vars: Record<string, string | number | undefined | null>): string {
  return String(tpl)
    .replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] === undefined || vars[k] === null ? '' : String(vars[k])))
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** What the coach is told about the conversation. `win` is the prototype's
    name for `proof`; either is accepted. */
export interface CoachContext {
  proof?: Pick<Proof, 'metric' | 'text'> | null;
  win?: Pick<Proof, 'metric' | 'text'> | null;
}

type CoachItem = Pick<AgendaItem, 'kind' | 'label'> & Partial<Pick<AgendaItem, 'id'>>;

export function opening(item: CoachItem | null | undefined, ctx?: CoachContext): string | null {
  const c = ctx || {};
  if (!item) return null;
  const key = (item.id || item.label || '') + '|open';

  if (item.kind === 'gap') {
    const r = readReq(item.label);
    const vars = {
      term: r.term || bare(item.label),
      label: bare(item.label),
      labelLower: lower(bare(item.label)),
    };
    return template(pick(GAP_OPENERS[r.cat] || GAP_OPENERS.other, key + r.cat) as string, vars);
  }

  const w = c.proof || c.win || { metric: '', text: item.label };
  const n = readWin(w);
  const bucket: WinBucket =
    n.kind === 'shift'
      ? n.worse ? 'shiftWorse' : 'shiftBetter'
      : n.kind === 'pct' || n.kind === 'count'
        ? 'plain'
        : n.kind in WIN_OPENERS ? (n.kind as WinBucket) : 'none';
  return template(pick(WIN_OPENERS[bucket], key + bucket) as string, { metric: n.metric, from: n.from, to: n.to });
}

/* ------------------------------------------------------------ follow-up --
   Chosen by what's missing from what they just said, so the second
   question is never the same as the first. Returns null when the answer
   is already complete enough to bank. */
const HEDGE = /\b(basically|kind of|sort of|pretty much|a lot of|various|several|stuff|things)\b/i;

export interface AnswerRead {
  words: number;
  hasNumber: boolean;
  hasI: boolean;
  weOnly: boolean;
  hasOutcome: boolean;
  hasObstacle: boolean;
  vague: boolean;
}

const OBSTACLE = new RegExp(
  '\\b(but|however|although|though|problem|issue|pushed? ?back|push-?back|' +
    'blocked|resist|refus|reluctan|sceptic|skeptic|hated|hate|complain|fought|friction|' +
    'failed|fail|broke|broken|stalled|stall|churn|slipped|slip|missed|behind|late|' +
    'took longer|harder|hard part|tough|messy|chaos|mess|nobody wanted|no one wanted|' +
    'struggl|painful|rough|fell over|went wrong)',
  'i',
);

export function readAnswer(text: string): AnswerRead {
  const t = String(text || '').trim();
  const words = t ? t.split(/\s+/).length : 0;
  return {
    words,
    hasNumber: /\d/.test(t),
    hasI: /\bI\b/.test(t),
    weOnly: /\bwe\b/i.test(t) && !/\bI\b/.test(t),
    hasOutcome: /\b(ended|closed|landed|result|finished|went from|grew|cut|saved|won|lost|renew)/i.test(t),
    hasObstacle: OBSTACLE.test(t),
    vague: HEDGE.test(t) && words < 60,
  };
}

export type Missing = 'thin' | 'we' | 'obstacle' | 'number' | 'outcome' | 'vague' | 'learned';

/** what's still missing, named, so both the probe and the tests can see it */
export function missing(answers: string[], letGo?: string[]): Missing | null {
  const last = answers[answers.length - 1] || '';
  const a = readAnswer(answers.join(' '));
  const l = readAnswer(last);
  const drop = letGo || [];
  const order: [Missing, boolean][] = [
    ['thin', l.words < 8],
    ['we', a.weOnly],
    ['obstacle', !a.hasObstacle],
    ['number', !a.hasNumber],
    ['outcome', !a.hasOutcome],
    ['vague', a.vague],
    ['learned', a.words < 45],
  ];
  for (let i = 0; i < order.length; i++) {
    if (order[i][1] && drop.indexOf(order[i][0]) === -1) return order[i][0];
  }
  return null;
}

const PROBES: Record<Missing, string[]> = {
  thin: ['Say a bit more.', 'What else was going on?', 'What happened next?'],
  we: ['What part of that was you?', 'You keep saying we. What did you do?', 'Which bit was actually yours?'],
  obstacle: ['What made it hard?', 'Did anything go wrong?', 'Where did it nearly fall apart?'],
  number: ['Do you have a number for that?', 'Roughly how big was it?', 'How long did it take?'],
  outcome: ['How did it turn out?', 'Where did it land?', 'And then what?'],
  vague: ['Which account was that?', 'Can you be more specific? A name, a quarter.', 'Give me a detail someone could check.'],
  learned: ['Would you do anything differently?', 'What did you take from it?', "Anything you'd change?"],
};

export function probe(what: string, key?: string, used?: string[]): string | null {
  const list = PROBES[what as Missing] || PROBES.thin;
  return used ? pickUnused(list, (key || '') + what, used) : pick(list, (key || '') + what);
}

/** kept for anything that wants a single line rather than a whole turn */
export function followUp(item: { id?: string } | null | undefined, answers: string[]): string | null {
  const what = missing(answers);
  return what ? probe(what, (item && item.id) + '|' + answers.length) : null;
}

/* ---------------------------------------------------------------- talk --
   A turn of actual conversation. Three things make this read like a person
   rather than a form: it says back the detail it heard before asking the
   next thing, it varies its wording, and it answers what was actually
   typed: "I don't know" and "what do you mean" get a different reply from
   a real answer. It stops when nothing is missing, reads the story back in
   the person's own words, and banks it once they say that's right. */

const DUNNO = /^(i (do not|don'?t) (know|remember)|not sure|no idea|dunno|cannot remember|can'?t remember|nope|no)\b/i;
const HUH = /^(what do you mean|what\?|huh|sorry\?|i do not follow|i don'?t follow|meaning\?|like what)/i;
const YES = /^(yes|yeah|yep|yup|that's right|that'?s right|correct|exactly|spot on|right|perfect|good|sounds right|ok|okay)\b/i;
const NO = /^(no|not quite|not really|nope|change|wrong|that's not|that'?s not)\b/i;

/** a bare yes, no or shrug is a reply to the coach, never part of a story */
export function isFiller(text: string): boolean {
  const t = String(text || '').trim();
  if (!t) return true;
  return /^(yes|yeah|yep|yup|correct|right|exactly|spot on|ok|okay|perfect|good|sounds right|that'?s right|no|nope|not quite|not really|i (do not|don'?t) know|not sure|no idea|dunno)[.!,\s]*(thanks|thank you)?[.!\s]*$/i.test(t);
}

export type CoachStage = 'open' | 'dig' | 'confirm' | 'done' | 'stall';

/** One line of a coach conversation. The prototype's shape is
    `{ role: 'assistant' | 'user', content, stage, want, story }`; the app's
    stored `CoachTurn` shape (`role: 'coach'`, `text`) is accepted as well. */
export interface CoachMessage {
  role: 'assistant' | 'coach' | 'user';
  content?: string;
  text?: string;
  stage?: CoachStage;
  want?: string | null;
  story?: string | null;
}

const said = (m: CoachMessage): string => (m.content ?? m.text ?? '');
const fromCoach = (m: CoachMessage): boolean => m.role === 'assistant' || m.role === 'coach';

/** what to bank when someone saves: the read-back they were shown if there
    is one, otherwise their own words with the filler taken out */
export function bankable(history?: CoachMessage[]): string {
  const h = history || [];
  let readBack: string | null = null;
  for (let i = h.length - 1; i >= 0; i--) {
    const m = h[i];
    if (fromCoach(m) && m.stage === 'confirm' && m.story) {
      readBack = m.story;
      break;
    }
    if (m.role === 'user' && !isFiller(said(m)) && i === h.length - 1) break;
  }
  if (readBack) return readBack;
  return h
    .filter((m) => m.role === 'user' && !isFiller(said(m)))
    .map(said)
    .join(' ');
}

const DUNNO_REPLIES: Record<Missing, string[]> = {
  thin: ['No worries. What do you remember?', "That's fine. What sticks out?"],
  we: ['What would your manager have said you did?', 'If someone had been watching, what would they have seen you do?'],
  obstacle: ['Maybe it was smooth. Did anyone push back?', 'Fair enough. Did anything take longer than it should have?'],
  number: ['A rough one is fine. Tens? Hundreds?', 'Ballpark it.'],
  outcome: ['Even "it\'s still going" works. Where\'s it at?', 'What was different at the end?'],
  vague: ['Leave the names out then. What happened?', "That's fine. Just tell me the order it went in."],
  learned: ['Fair. Not everything has a lesson.', "That's fine, leave it."],
};

export function mirror(text: string, key?: string): string | null {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  /* the most quotable thing in what they said: a figure with its unit,
     then a proper noun, then nothing: we never mirror a whole sentence
     back, because that's what a chatbot does, not a person */
  const UNIT =
    '(?:\\s?(?:%|k\\b|m\\b|bn?\\b|x\\b|days?|weeks?|months?|quarters?|years?|reps?|' +
    'accounts?|deals?|calls?|logos?|people|hours?))';
  /* money first, then a figure that carries its unit, then a bare number:
     "$1.2M" is worth saying back, "30" on its own usually isn't */
  let got: string | null = null;
  const money = t.match(/[$£€]\s?\d[\d.,]*\s?[kmb]?n?\b/i);
  const united = t.match(new RegExp('\\d[\\d.,]*' + UNIT, 'i'));
  const name = t.match(/\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\b/);
  /* a month or a weekday is a proper noun but saying it back tells the
     person nothing, so those do not count as something worth mirroring */
  const WEAK =
    /^(January|February|March|April|May|June|July|August|September|October|November|December|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|The|This|That|There|They|We|It|And|But|So|Then|After|Before|When|What|My|Our)$/i;
  if (money) got = money[0].trim();
  else if (united) got = united[0].trim();
  else if (name && !/^I\b/.test(name[1]) && !WEAK.test(name[1])) got = name[1];
  if (!got) return null;
  return template(
    pick(['{got}, okay.', 'Right, {got}.', '{got}. Got it.', 'Okay, {got}.'], (key || '') + got) as string,
    { got },
  );
}

/* their own words, trimmed: never a rewrite, never an invention */
function dedupe(list: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  (list || []).forEach((x) => {
    const k = String(x).toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(x);
  });
  return out;
}

export function summary(answers: string[] | null | undefined): string {
  /* someone who types the same thing three times gets it back once */
  const all = dedupe((answers || []).filter((x) => !isFiller(x))).join(' ').replace(/\s+/g, ' ').trim();
  if (!all) return '';
  let sentences = all
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 12);
  if (!sentences.length) sentences = [all];
  const unique = dedupe(sentences);
  const strong = unique.filter((x) => /\d/.test(x) || /\bI\b/.test(x));
  return (strong.length ? strong : unique).slice(0, 3).join(' ').trim();
}

/** is there enough here to be worth putting on a page at all? */
export function worthKeeping(story: string | null | undefined): boolean {
  const t = String(story || '').trim();
  if (!t) return false;
  const words = t.split(/\s+/).length;
  return words >= 14 && (/\d/.test(t) || /\bI\b/.test(t));
}

const CONFIRM = [
  'Here\'s what I have: "{story}" Sound right?',
  'So: "{story}" Is that how you\'d say it?',
  '"{story}" That work?',
];

/** A coach turn: the `CoachReply` plus where the conversation now stands.
    Append each bubble to the history as an `assistant` message carrying
    `stage`, `want` and `story`, which is how the next turn knows where it is.
    `story` is the empty string while there is no story. */
export interface CoachResult extends CoachReply {
  stage: CoachStage;
  want?: Missing | null;
}

export function turn(item: CoachItem | null | undefined, history?: CoachMessage[], ctx?: CoachContext): CoachResult {
  const h = history || [];
  const answers = h.filter((m) => m.role === 'user').map(said);
  const assistants = h.filter(fromCoach);
  const prev: Partial<CoachMessage> = assistants[assistants.length - 1] || {};
  const key = (item && item.id ? item.id : 'x') + '|' + answers.length;

  if (!answers.length) {
    return { bubbles: [opening(item, ctx) as string], stage: 'open', complete: false, story: '' };
  }

  const last = answers[answers.length - 1] || '';

  /* they were asked to confirm the write-up */
  if (prev.stage === 'confirm') {
    if (YES.test(last.trim())) {
      return {
        bubbles: [pick(["Good. That's one down.", 'Saved. Pick the next one.', 'Got it. Next?'], key) as string],
        stage: 'done',
        complete: true,
        story: prev.story || summary(answers.slice(0, -1)),
      };
    }
    if (NO.test(last.trim()) || last.trim().length < 40) {
      return {
        bubbles: [pick(["Okay, say it how you'd want it said.", "Fair. Put it your way and I'll keep that."], key) as string],
        stage: 'dig',
        complete: false,
        story: '',
      };
    }
    /* they rewrote it themselves, which is the best possible outcome */
    return {
      bubbles: [pick(['Better. Keeping that.', "That's stronger. Saved."], key) as string],
      stage: 'done',
      complete: true,
      story: last,
    };
  }

  /* What has already been said, and what has already been asked about.
     Anything asked twice is let go: pressing a third time on the same
     thing is interrogation, not conversation. */
  const used = assistants.map(said);
  const asked = assistants.map((m) => m.want).filter((w): w is string => !!w);
  const letGo = asked.filter((w, i) => asked.indexOf(w) !== i);
  let what = missing(answers, letGo);

  /* and a conversation that never ends is worse than one that ends early */
  if (asked.length >= 5) what = null;

  /* a first answer that already carries a number, an obstacle and an
     outcome needs no probe: read it back */
  if (answers.length === 1) {
    const first = readAnswer(last);
    if (first.words >= 14 && first.hasNumber && first.hasObstacle && first.hasOutcome) what = null;
  }

  /* "I don't know" is an answer, and pretending otherwise is what makes
     these things infuriating */
  if (DUNNO.test(last.trim())) {
    const soft = DUNNO_REPLIES[what || 'learned'] || DUNNO_REPLIES.thin;
    return {
      bubbles: [(pickUnused(soft, key, used) || pick(soft, key)) as string],
      stage: 'dig',
      want: what,
      complete: false,
      story: '',
    };
  }
  /* they didn't understand the question, so ask it another way rather
     than repeating the same sentence louder */
  if (HUH.test(last.trim())) {
    const again = probe(what || 'thin', key + '|again', used);
    return {
      bubbles: [again || "Just say it how you'd say it to a colleague."],
      stage: 'dig',
      want: what,
      complete: false,
      story: '',
    };
  }

  if (what) {
    const line = probe(what, key, used);
    if (line) {
      const bubbles: string[] = [];
      const m = answers.length > 1 || readAnswer(last).words > 14 ? mirror(last, key) : null;
      if (m && used.indexOf(m) === -1) bubbles.push(m);
      bubbles.push(line);
      return { bubbles, stage: 'dig', want: what, complete: false, story: '' };
    }
    /* every way of asking that has been spent, so stop asking it */
  }

  /* nothing missing: read it back and let them own it. If there's nothing
     worth reading back, say that instead of quoting filler at them. */
  const story = summary(answers);
  if (!worthKeeping(story)) {
    return {
      bubbles: [
        pick(
          [
            "There's not much here yet. Come back to this one when it's fresher.",
            "I wouldn't use this one yet. Try another and come back to it.",
          ],
          key,
        ) as string,
      ],
      stage: 'stall',
      want: null,
      complete: false,
      story: '',
    };
  }
  return {
    bubbles: [template(pick(CONFIRM, key) as string, { story })],
    stage: 'confirm',
    complete: false,
    story,
  };
}

/* ---------------------------------------------------------- the brief ---
   Likely questions, questions worth asking back, and the things to be
   careful about, all assembled out of this opportunity. `proof` is the
   proof list; only the points the opportunity leads with are asked about. */
export function questions(
  opportunity: Pick<Opportunity, 'requirements' | 'research' | 'contacts'> & Partial<Pick<Opportunity, 'proofIds'>>,
  proof: Proof[] = [],
): InterviewQuestions {
  const lead = opportunity.proofIds
    ? opportunity.proofIds.map((id) => proof.find((p) => p.id === id)).filter((p): p is Proof => !!p)
    : proof;
  const likely: LikelyQuestion[] = [];
  const toAsk: InterviewQuestions['toAsk'] = [];
  const watch: string[] = [];
  const reqs: Requirement[] = opportunity.requirements || [];

  reqs.forEach((r) => {
    const q = readReq(r);
    if (r.strength === 'none') {
      likely.push({
        question: asQuestion(r.text),
        why: 'They asked for it. Nothing on your résumé answers this.',
        gap: r.note ? '' : 'You have not worked out what to say. Do it in Story.',
        answer: r.note || '',
        kind: 'gap',
        ref: r.id,
      });
      watch.push(
        'Nothing backs "' + clip(bare(r.text), 70) + '". Have the nearest thing ' +
          'you have done ready, and be the one to say what it is not.',
      );
    } else if (r.priority === 'must') {
      likely.push({
        question: asQuestion(r.text),
        why: 'A must-have you can answer. Have one story, not three.',
        gap: '',
        answer: r.note || '',
        kind: 'strength',
        ref: r.id,
      });
    }
    if (q.cat === 'method' && q.term) {
      toAsk.push({
        question: 'How strictly is ' + q.term + ' actually run here?',
        why: 'Listings name a methodology more often than teams run one.',
      });
    }
    if (q.cat === 'scale' && q.term) {
      toAsk.push({
        question: 'What did the last three people in this seat hit against that number?',
        why: 'The quota is in the listing. The attainment never is.',
      });
    }
  });

  lead.forEach((w) => {
    const n = readWin(w);
    if (n.kind === 'none') return;
    likely.push({
      question:
        n.kind === 'loss'
          ? 'You mention ' + w.metric + '. What was your part in that?'
          : 'You mention ' + w.metric + '. How did you get there?',
      why: 'Any number on a résumé is an invitation. They will pick this one.',
      gap: '',
      answer: '',
      kind: 'win',
      ref: w.id,
    });
  });

  const research = opportunity.research || [];

  /* a question someone reported being asked beats anything we could infer,
     so those go to the top of the list and say where they came from */
  research.forEach((r) => {
    if (r.kind !== 'Interview question' || !r.title) return;
    likely.unshift({
      question: clip(r.title, 200),
      why:
        'Reported by a candidate' + (r.source ? ' on ' + r.source : '') +
        '. This is not inference — someone was actually asked it.',
      answer: r.use || '',
      gap: '',
      kind: 'reported',
      ref: r.id,
    });
  });

  /* what the product's own customers complain about is the best material
     a salesperson can walk in with */
  const gripes = research.filter((r) => r.kind === 'Customer gripe' && r.title);
  gripes.slice(0, 3).forEach((r) => {
    toAsk.unshift({
      question: 'Customers keep saying ' + lower(clip(r.title, 110)) + ' How does the team handle that on a call?',
      why: 'From a review' + (r.source ? ' on ' + r.source : '') + '. Asking it shows you did the work.',
    });
  });
  if (gripes.length > 1) {
    watch.push(
      gripes.length + ' customer complaints are on the same theme. Expect a question about ' +
        'selling against it, and have an answer that is not a denial.',
    );
  }

  research
    .filter((r) => r.kind !== 'Interview question' && r.kind !== 'Customer gripe' && r.kind !== 'Customer voice')
    .slice(0, 3)
    .forEach((r) => {
      if (!r.title) return;
      toAsk.push({
        question: 'On ' + clip(r.title, 80) + ' — what has changed since?',
        why: 'Asking about something you actually found lands differently from a generic question.',
      });
    });

  (opportunity.contacts || []).forEach((p) => {
    const act = (p.activity || [])[0];
    if (!act || !act.text) return;
    /* activity is our description of what they posted, not their words, so
       it goes in as a description and never inside quote marks */
    likely.push({
      question: join((p.name || 'Someone on the panel') + ' ' + lower(clip(act.text, 120)), 'How would you handle that?'),
      why: 'Said in public. If they are in the room, it is already on their mind.',
      answer: '',
      gap: '',
      kind: 'person',
      ref: p.id,
    });
  });

  const unanswered = reqs.filter((r) => r.strength === 'none' && !r.note).length;
  if (unanswered > 2) {
    watch.unshift(
      unanswered + ' requirements have nothing behind them and no answer written. ' + "That's the interview, not a detail.",
    );
  }

  return {
    likely: likely.slice(0, 10),
    toAsk: toAsk.slice(0, 6),
    watch: watch.slice(0, 5),
    source: 'local',
  };
}
