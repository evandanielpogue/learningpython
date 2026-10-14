/* ==========================================================================
   Model prompts and JSON schemas, ported from the prototype's ai.js.

   The prose is as written there. The only renames are the schema field names
   the new domain types use: `wins` -> `proof` and `winIds` -> `proofIds`.
   No SDK calls live here; routes import these and make the request.
   ========================================================================== */

export type JsonSchema = Record<string, unknown>;

/** The models the settings screen offers. */
export const MODELS = [
  { id: 'claude-opus-5', name: 'Opus 5', note: 'Best at reading a messy résumé' },
  { id: 'claude-sonnet-5', name: 'Sonnet 5', note: 'Faster and cheaper, still good' },
  { id: 'claude-haiku-4-5', name: 'Haiku 4.5', note: 'Cheapest. Misses things.' },
] as const;

/** Settings: the connectivity check. */
export const TEST_PROMPT = 'Reply with the single word: ready';

/* ---- feature: résumé reading ------------------------------------------ */

/** résumé reading: the shape a résumé comes back as. */
export const RESUME_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'email', 'phone', 'location', 'years', 'roles', 'proof', 'tools', 'voice'],
  properties: {
    name: { type: 'string', description: 'Their full name. Empty string if it is not in the document.' },
    email: { type: 'string' },
    phone: { type: 'string' },
    location: { type: 'string', description: 'City and state or country, as written.' },
    years: { type: 'integer', description: 'Total years of professional experience, worked out from the dates. 0 if unclear.' },
    roles: {
      type: 'array',
      description: 'Every job, most recent first.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'company', 'span', 'bullets'],
        properties: {
          title: { type: 'string' },
          company: { type: 'string', description: 'Company, and location if given.' },
          span: { type: 'string', description: 'Like "2023 to now" or "2021 to 2023".' },
          bullets: {
            type: 'array',
            description: 'What they did there, cleaned up but not reworded.',
            items: { type: 'string' },
          },
        },
      },
    },
    proof: {
      type: 'array',
      description: 'Achievements with a number attached. One per distinct result, deduplicated.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'metric', 'short', 'where', 'tags'],
        properties: {
          text: { type: 'string', description: 'The achievement in their own words.' },
          metric: { type: 'string', description: 'Just the number, formatted tight: 112%, $1.2M, 30-70, Top 3.' },
          short: { type: 'string', description: 'Five to nine words naming what the number measures, without repeating the number. Reads as a phrase: "through a pricing change", "territory ARR growth".' },
          where: { type: 'string', description: 'Company and period it happened at.' },
          tags: {
            type: 'array',
            description: 'Lowercase single words a job listing might use for this: pricing, quota, ramp, discovery, territory, enterprise, outbound, team.',
            items: { type: 'string' },
          },
        },
      },
    },
    tools: { type: 'array', description: 'Software and methodologies named.', items: { type: 'string' } },
    voice: {
      type: 'array',
      description: 'Two to four short labels for how this person writes, read off their own bullets.',
      items: { type: 'string' },
    },
  },
};

/** résumé reading: the system prompt. */
export const RESUME_SYSTEM = [
  'You read resumes and pull out what a job seeker would use to write to a hiring manager.',
  '',
  'Rules:',
  '- Take what is on the page. Do not invent a title, a number, or a date that is not there.',
  '- A win needs a number in it. "Grew the territory" is not a win. "Grew territory ARR 41%" is.',
  '- Keep their words in text and bullets. You are extracting, not rewriting.',
  '- short must not repeat the number that is already in metric, and must read as a phrase.',
  '- If a field is not in the document, return an empty string or an empty array. Never guess.',
].join('\n');

/** résumé reading: the user message. */
export function resumeMessage(text: string): string {
  return 'Here is the resume:\n\n<resume>\n' + text + '\n</resume>';
}

/* ---- feature: posting fetch ------------------------------------------- */

/** posting fetch: why a fetch failed, keyed by the API's error code. */
export const POSTING_ERRORS: Record<string, string> = {
  url_not_accessible: 'That page would not load. Job boards often block anything that is not a browser, and anything behind a login is out of reach.',
  url_not_allowed: 'That address is not one we are allowed to fetch.',
  url_not_in_prior_context: 'The link did not make it through. Try pasting it again.',
  url_too_long: 'That link is too long to fetch.',
  invalid_tool_input: 'That does not look like a web address.',
  unsupported_content_type: 'We can read web pages and PDFs, nothing else.',
  too_many_requests: 'Rate limited. Give it a minute.',
  max_uses_exceeded: 'Gave up after two tries.',
  unavailable: 'The fetch failed on their end.',
};

/** posting fetch: refusal shown for a LinkedIn link. */
export const POSTING_LINKEDIN_REFUSAL =
  'We will not fetch LinkedIn. Their terms prohibit automated access and it is your ' +
  'account that gets closed, not ours. Open the posting and paste the text.';

/** posting fetch: refusal shown for a non-https link. */
export const POSTING_HTTPS_ONLY = 'Only https links can be fetched.';

/** posting fetch: shown when the page held no posting. */
export const POSTING_EMPTY =
  'There was no job posting on that page. Sites that build the listing in the browser, LinkedIn among them, come back blank.';

/** posting fetch: what the model replies when the page is not a posting. */
export const POSTING_NOT_A_POSTING = 'NOT_A_POSTING';

/** posting fetch: the system prompt. */
export const POSTING_SYSTEM = [
  'You are given a link to a job posting. Fetch it and return the posting as plain text.',
  '',
  'Return the posting only. Start with the job title, then a line with the company, location',
  'and any requisition number. Then the body, keeping the responsibilities and requirements as',
  'the bullet list they already are. Drop the site navigation, the cookie notice, the "apply',
  'now" furniture, the benefits boilerplate and anything about other roles.',
  '',
  'Do not summarise, do not comment, do not add a preamble. If the page is not a job posting,',
  'or the text is not there, reply with exactly: NOT_A_POSTING',
].join('\n');

/** posting fetch: the user message. */
export function postingMessage(url: string): string {
  return 'Here is the posting: ' + url;
}

/** posting fetch: the server-side web fetch tool. `blockedDomains` is
    `noFetch` from the engine's sources: fetching LinkedIn through the model
    is still automated access to LinkedIn, which their user agreement
    prohibits and which is what ends in a terminated account. */
export function postingTool(blockedDomains: string[]) {
  return {
    type: 'web_fetch_20250910' as const,
    name: 'web_fetch' as const,
    max_uses: 2,
    max_content_tokens: 20000,
    blocked_domains: blockedDomains,
  };
}

/** posting fetch: token budget. */
export const POSTING_MAX_TOKENS = 4000;

/* ---- feature: listing match ------------------------------------------- */

/** listing match: the system prompt. */
export const MATCH_SYSTEM = [
  'You compare a job listing against one person’s resume and say, line by line, where they',
  'line up and where they do not.',
  '',
  'For every requirement the listing states, find the evidence on the resume and name it by id.',
  'strong means the resume shows they have done this, with something concrete. partial means it',
  'is adjacent or implied. none means there is nothing there, and you must say none rather than',
  'stretch: an honest gap is the useful part of this.',
  '',
  'note is one short line, under 15 words, saying what the evidence actually is or what is',
  'missing. Do not repeat the requirement back.',
  '',
  'leadWith is the three win ids that answer the most important requirements. Exactly three,',
  'or fewer only if there are fewer wins.',
].join('\n');

/** listing match: the response shape. */
export const MATCH_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['requirements', 'leadWith'],
  properties: {
    requirements: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'priority', 'proofIds', 'strength', 'note'],
        properties: {
          text: { type: 'string', description: 'The requirement, as the listing puts it, trimmed.' },
          priority: { type: 'string', enum: ['must', 'nice'] },
          proofIds: { type: 'array', items: { type: 'string' }, description: 'Ids of the wins that evidence this. Empty when there is none.' },
          strength: { type: 'string', enum: ['strong', 'partial', 'none'] },
          note: { type: 'string' },
        },
      },
    },
    leadWith: { type: 'array', items: { type: 'string' }, description: 'Three win ids.' },
  },
};

/** listing match: token budget. */
export const MATCH_MAX_TOKENS = 4000;

/** listing match: the user message. `proof` is the whole proof list, `roles`
    the profile's roles, `requirements` what the local reader already pulled. */
export function matchMessage(
  listing: string,
  proof: { id: string; text: string; where?: string }[],
  roles: { title: string; company: string; span: string; bullets: string[] }[],
  requirements?: string[],
): string {
  const wins = proof.map((w) => w.id + ': ' + w.text + ' (' + (w.where || 'no date') + ')').join('\n');
  const rolesText = roles
    .map((r) => '- ' + r.title + ', ' + r.company + ', ' + r.span + ': ' + r.bullets.join('; '))
    .join('\n');
  return (
    'The listing:\n<listing>\n' + listing + '\n</listing>\n\n' +
    'Their wins, by id:\n' + wins + '\n\nTheir roles:\n' + rolesText +
    (requirements && requirements.length
      ? '\n\nRequirements we already pulled out, if useful:\n- ' + requirements.join('\n- ')
      : '')
  );
}

/* ---- feature: prep turn (the conversation that fills the gaps) --------- */

/** prep turn: the system prompt. */
export const PREP_SYSTEM = [
  'You are helping someone get ready to apply for a specific job. You work through one thing at',
  'a time and you are after detail a resume bullet cannot hold: what broke, what they did, in',
  'what order, what it cost, how it ended, and the number if there is one.',
  '',
  'Ask ONE question per message. Under 25 words. No preamble, no flattery, no summarising back',
  'at length. If their answer is vague, ask the sharper version of the same question rather than',
  'moving on. Two or three exchanges on one item is usually enough.',
  '',
  'When you have something they could actually say out loud to a hiring manager, put it in story',
  'as three or four sentences in their own voice, first person, past tense, and set complete to',
  'true. Until then story is an empty string and complete is false.',
  '',
  'If the item is a gap, something the listing wants that their resume does not show, do not',
  'invent coverage. Look for the nearest real thing they have done and say plainly if there is',
  'nothing. A gap they can speak to honestly beats a gap they have papered over.',
].join('\n');

/** prep turn: the response shape. */
export const PREP_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'story', 'complete'],
  properties: {
    reply: { type: 'string', description: 'What you say next. One question, under 25 words, unless you are done.' },
    story: { type: 'string', description: 'The finished story in their voice, or an empty string.' },
    complete: { type: 'boolean' },
  },
};

/** prep turn: token budget. */
export const PREP_MAX_TOKENS = 900;

/** prep turn: the opening user message that frames the item. */
export function prepHead(opportunity: { role: string; company: string }, item: { kind: 'story' | 'gap'; label: string }): string {
  return (
    'Job: ' + opportunity.role + ' at ' + opportunity.company + '.\n' +
    (item.kind === 'gap'
      ? 'This is a gap. The listing asks for: "' + item.label + '". Their resume does not show it.'
      : 'They are leading with this win: "' + item.label + '". Get the story behind it.')
  );
}

/* ---- feature: story turn ----------------------------------------------- */

/** story turn: the system prompt (questions that turn a bullet into a story). */
export const STORY_SYSTEM = [
  'You are helping a job seeker turn one achievement from their resume into a story they can',
  'tell a hiring manager. Ask one short question at a time. Three or four in total, then stop.',
  '',
  'Ask about what actually happened: what broke, what they did, what it cost, how it ended.',
  'Never ask more than one thing in a message. Never flatter them. Never summarise back to',
  'them at length. Keep every message under 25 words.',
  '',
  'When you have enough, say so in one line and stop asking.',
].join('\n');

/** story turn: token budget. */
export const STORY_MAX_TOKENS = 400;

/** story turn: the opening user message. */
export function storyIntro(opportunity: { role: string; company: string }, proof?: { text: string } | null): string {
  return (
    'They are applying for ' + opportunity.role + ' at ' + opportunity.company + '.' +
    (proof ? ' They are leading with: "' + proof.text + '".' : '')
  );
}

/* ---- feature: story summary -------------------------------------------- */

/** story summary: pulls the answers together into something the page can print. */
export const STORY_SUMMARY_SYSTEM =
  'Write what the person told you as three or four plain sentences, in their voice, ' +
  'first person, past tense. No preamble, no heading, no flourish. Only what they said.';

/** story summary: the closing user message. */
export const STORY_SUMMARY_USER = 'Write it up now, nothing else.';

/** story summary: token budget. */
export const STORY_SUMMARY_MAX_TOKENS = 500;

/* ---- feature: interview prep ------------------------------------------- */

/** interview prep: the system prompt. */
export const INTERVIEW_SYSTEM = [
  'You prepare someone for a specific interview. You have their resume, the listing, what',
  'they line up on, what they do not, the stories they have told you, who they have spoken',
  'to and what those people said in public.',
  '',
  'Write the questions this company is actually likely to ask this person, in this role.',
  'Not a generic list. Every question must be traceable to something in the material: a gap,',
  'a number on their resume, something the listing dwells on, something a person there said.',
  '',
  'For each one, say in a line why it is coming, and give them the spine of an answer built',
  'only from what they have told you. If they have not told you enough to answer it, leave',
  'answer empty and say what they still need to work out. Never invent an experience.',
  '',
  'Then: questions worth asking back, each tied to something specific you know about the',
  'company. And the things to be careful about, which are usually the gaps.',
].join('\n');

const INTERVIEW_QUESTION: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['question', 'why', 'answer', 'gap'],
  properties: {
    question: { type: 'string' },
    why: { type: 'string', description: 'One line, under 20 words, on why this is coming.' },
    answer: { type: 'string', description: 'The spine of their answer from their own material, or an empty string.' },
    gap: { type: 'string', description: 'What they still need to work out, or an empty string.' },
  },
};

/** interview prep: the response shape. */
export const INTERVIEW_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['likely', 'toAsk', 'watch'],
  properties: {
    likely: { type: 'array', items: INTERVIEW_QUESTION, description: 'Six to nine questions they will probably be asked.' },
    toAsk: {
      type: 'array',
      description: 'Three or four questions worth asking back, each tied to something specific.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'why'],
        properties: { question: { type: 'string' }, why: { type: 'string' } },
      },
    },
    watch: {
      type: 'array',
      description: 'Two or three things to be careful about in the room.',
      items: { type: 'string' },
    },
  },
};

/** interview prep: token budget. */
export const INTERVIEW_MAX_TOKENS = 6000;

/** Everything known about one opportunity, as the interview prompt reads it. */
export interface InterviewBrief {
  role: string;
  company: string;
  location?: string;
  match: { strength: string; text: string; evidence: string[]; answer?: string }[];
  proof: { metric: string; text: string; story?: string }[];
  people: { name: string; label: string; touches: number; replied: boolean; activity: string[] }[];
  research: { title: string; detail: string }[];
}

/** interview prep: the user message, assembled from the brief. */
export function interviewContext(b: InterviewBrief): string {
  return [
    'Role: ' + b.role + ' at ' + b.company + (b.location ? ' (' + b.location + ')' : ''),
    '',
    'What they asked for and how it lines up:',
    b.match
      .map(
        (m) =>
          '- [' + m.strength + '] ' + m.text +
          (m.evidence.length ? ' | evidence: ' + m.evidence.join('; ') : ' | nothing on the resume') +
          (m.answer ? ' | they say: ' + m.answer : ''),
      )
      .join('\n') || '(no requirements parsed)',
    '',
    'What they lead with:',
    b.proof.map((w) => '- ' + w.metric + ' ' + w.text + (w.story ? '\n  story: ' + w.story : '')).join('\n') || '(none)',
    '',
    'People they have contacted:',
    b.people
      .map(
        (p) =>
          '- ' + p.name + ', ' + p.label +
          (p.touches ? ' | ' + p.touches + ' touches, ' + (p.replied ? 'replied' : 'no reply yet') : ' | not contacted') +
          (p.activity.length ? '\n  said publicly: ' + p.activity.join(' / ') : ''),
      )
      .join('\n') || '(none)',
    '',
    'What the company said in public:',
    b.research.map((r) => '- ' + r.title + ': ' + r.detail).join('\n') || '(nothing gathered)',
  ].join('\n');
}

/* ---- feature: rewrite -------------------------------------------------- */

/** rewrite: the system prompt (editing one outreach message). */
export const REWRITE_SYSTEM = [
  'You edit one outreach message at a time for a job seeker. You get the current draft and',
  'what they want changed. Return the whole message rewritten, and one short line saying what',
  'you did.',
  '',
  'Hold to this: no greeting beyond their first name, no "I hope this finds you well", no',
  'adjectives doing the work of facts, one ask at the end. Keep any real number that is already',
  'there. Never invent a number, a name, or a claim that is not in the draft.',
].join('\n');

/** rewrite: the response shape. */
export const REWRITE_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'body'],
  properties: {
    reply: { type: 'string', description: 'One line, under 12 words, saying what you changed.' },
    body: { type: 'string', description: 'The full rewritten message.' },
  },
};

/** rewrite: token budget. */
export const REWRITE_MAX_TOKENS = 2000;

/** rewrite: the user message. `told` is the stories the person has banked. */
export function rewriteMessage(
  ask: string,
  draft: string,
  opportunity: { company: string; role: string },
  contact: { name: string; title?: string; persona: string } | null | undefined,
  told: { text: string }[],
): string {
  return (
    'Company: ' + opportunity.company + '\nRole: ' + opportunity.role +
    (contact ? '\nGoing to: ' + contact.name + ', ' + (contact.title || contact.persona) : '') +
    (told.length
      ? '\n\nWhat they have told me about themselves, in their own words. Use these rather ' +
        'than inventing anything, and keep their phrasing:\n' +
        told.map((t) => '- ' + t.text).join('\n')
      : '') +
    '\n\nCurrent draft:\n' + draft + '\n\nWhat they want: ' + ask
  );
}
